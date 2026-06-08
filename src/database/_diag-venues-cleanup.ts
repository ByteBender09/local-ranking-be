import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, IsNull, In } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue, City } from './entities';

dotenv.config();

// One-off data cleanup. Dry-run by default; pass --apply to commit.
//
// Phases (in order):
//   A. Soft-delete non-POI rows (airports, broadcast, hospitals, bus stops…)
//   B. Soft-delete hotel/apartment rows that are NOT category=homestay
//   C. Re-categorize beach venues in inland cities (Đà Lạt, Hà Nội, Sa Pa,
//      Ninh Bình, Huế) using tag/name heuristics
//   D. Normalize rooftop tag/category — tag literal 'rooftop'→'bar',
//      tag 'Quán bar trên sân thượng'→'Quán bar', name like "Rooftop Bar"/
//      "Sky Bar" but category≠bar → category=bar
//   E. Soft-delete low-quality non-curated venues (reviews<100 AND rating<4.0)

const APPLY = process.argv.includes('--apply');

const NON_POI_TAGS = [
  'Sân bay', 'Sân bay quốc tế', 'Trường quay truyền hình', 'Đài phát thanh',
  'Bệnh viện', 'Trường học', 'Trạm xe buýt', 'Trạm xăng', 'Bến xe',
  'Ngân hàng', 'Văn phòng chính phủ', 'Bưu điện', 'Đập nước',
];

const HOTEL_TAGS = [
  'Khách sạn', 'Căn hộ nghỉ mát', 'Resort', 'Khu nghỉ dưỡng', 'Nhà nghỉ',
  'Khu nghỉ mát', 'Khách sạn 5 sao', 'Khách sạn 4 sao', 'Khách sạn 3 sao',
  'Khách sạn 2 sao', 'Hotel', 'Boutique hotel', 'Khu lưu trú',
];

const INLAND_CITY_SLUGS = ['da-lat', 'ha-noi', 'sa-pa', 'ninh-binh', 'hue'];

type Cat = 'cafe' | 'restaurant' | 'street_food' | 'viewpoint' | 'beach'
  | 'homestay' | 'bar' | 'museum' | 'park' | 'shopping';

function recategorizeBeach(citySlug: string, tags: string[], name: string): Cat {
  const lower = name.toLowerCase();
  if (tags.includes('Công viên')) return 'park';
  if (tags.includes('Nhà hàng')) return 'restaurant';
  if ((citySlug === 'hue' || citySlug === 'hoi-an') &&
      (tags.includes('Khu vực đi bộ') || lower.includes('đi bộ'))) {
    return 'street_food';
  }
  if (tags.includes('Hồ') || tags.includes('Đập nước') ||
      lower.startsWith('hồ ') || lower.includes('reservoir')) {
    return 'viewpoint';
  }
  return 'viewpoint';
}

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const venueRepo = ds.getRepository(Venue);
  const cityRepo = ds.getRepository(City);

  console.log(`\n${APPLY ? '🔴 APPLY mode — changes will be committed' : '🟡 DRY-RUN mode (pass --apply to commit)'}`);

  // ── PHASE A: Non-POI ──
  console.log('\n── Phase A: soft-delete non-POI ──');
  const phaseA = await venueRepo.createQueryBuilder('v')
    .leftJoinAndSelect('v.city', 'c')
    .where('v.deletedAt IS NULL')
    .andWhere('v.isPublished = true')
    .andWhere(`v.category <> 'homestay'`)
    .andWhere(`v.tags && :tags::text[]`, { tags: NON_POI_TAGS })
    .getMany();
  console.log(`  Found ${phaseA.length} non-POI venues`);
  for (const v of phaseA) {
    console.log(`    [DELETE] ${v.city?.name ?? '?'} / ${v.category} / ${v.name}  tags=${JSON.stringify(v.tags)}`);
  }
  if (APPLY && phaseA.length > 0) {
    await venueRepo.softDelete({ id: In(phaseA.map((v) => v.id)) });
    console.log(`  ✓ Soft-deleted ${phaseA.length}`);
  }

  // ── PHASE B: Hotels/apartments (skip homestay) ──
  console.log('\n── Phase B: soft-delete hotels/apartments (keep homestay) ──');
  const phaseB = await venueRepo.createQueryBuilder('v')
    .leftJoinAndSelect('v.city', 'c')
    .where('v.deletedAt IS NULL')
    .andWhere('v.isPublished = true')
    .andWhere(`v.category <> 'homestay'`)
    .andWhere(`v.tags && :tags::text[]`, { tags: HOTEL_TAGS })
    .getMany();
  console.log(`  Found ${phaseB.length} hotel/apartment venues`);
  for (const v of phaseB) {
    console.log(`    [DELETE] ${v.city?.name ?? '?'} / ${v.category} / ${v.name}  tags=${JSON.stringify(v.tags)}`);
  }
  if (APPLY && phaseB.length > 0) {
    await venueRepo.softDelete({ id: In(phaseB.map((v) => v.id)) });
    console.log(`  ✓ Soft-deleted ${phaseB.length}`);
  }

  // ── PHASE C: Re-categorize beach in inland cities ──
  console.log('\n── Phase C: re-categorize beach in inland cities ──');
  const cities = await cityRepo.find({ where: { slug: In(INLAND_CITY_SLUGS) } });
  const cityById = new Map(cities.map((c) => [c.id, c.slug]));
  const phaseC = await venueRepo.createQueryBuilder('v')
    .where('v.deletedAt IS NULL')
    .andWhere(`v.category = 'beach'`)
    .andWhere('v.cityId IN (:...ids)', { ids: cities.map((c) => c.id) })
    .getMany();
  console.log(`  Found ${phaseC.length} inland beach venues`);
  const updates: Array<{ id: string; from: string; to: Cat; name: string; city: string }> = [];
  for (const v of phaseC) {
    const slug = cityById.get(v.cityId)!;
    const target = recategorizeBeach(slug, v.tags ?? [], v.name);
    updates.push({ id: v.id, from: v.category, to: target, name: v.name, city: slug });
  }
  for (const u of updates) {
    console.log(`    [RE-CAT] [${u.city}] ${u.from}→${u.to}  ${u.name}`);
  }
  if (APPLY && updates.length > 0) {
    for (const u of updates) {
      await venueRepo.update({ id: u.id }, { category: u.to as Cat });
    }
    console.log(`  ✓ Re-categorized ${updates.length}`);
  }

  // ── PHASE D: Rooftop normalization ──
  console.log('\n── Phase D: rooftop tag/category normalization ──');
  // D1: any tag literal 'rooftop' → 'bar'; 'Quán bar trên sân thượng' → 'Quán bar'
  const phaseDtag = await venueRepo.createQueryBuilder('v')
    .leftJoinAndSelect('v.city', 'c')
    .where('v.deletedAt IS NULL')
    .andWhere(`v.tags && ARRAY['rooftop','Quán bar trên sân thượng']::text[]`)
    .getMany();
  console.log(`  D1: ${phaseDtag.length} venues with rooftop/sân thượng tag literals`);
  for (const v of phaseDtag) {
    const before = v.tags ?? [];
    const next = Array.from(new Set(before.map((t) => {
      if (t === 'rooftop') return 'bar';
      if (t === 'Quán bar trên sân thượng') return 'Quán bar';
      return t;
    })));
    console.log(`    [TAG]    ${v.city?.name ?? '?'} / ${v.category} / ${v.name}  ${JSON.stringify(before)} → ${JSON.stringify(next)}`);
    if (APPLY) await venueRepo.update({ id: v.id }, { tags: next });
  }

  // D2: name contains "rooftop bar"/"sky bar"/"rooftop lounge"/"rooftop pool" & category != bar → set category=bar
  const phaseDname = await venueRepo.createQueryBuilder('v')
    .leftJoinAndSelect('v.city', 'c')
    .where('v.deletedAt IS NULL')
    .andWhere(`v.category <> 'bar'`)
    .andWhere(`(v.name ~* :pat)`, { pat: '(rooftop|sky)\\s*bar|rooftop\\s*lounge' })
    .getMany();
  console.log(`  D2: ${phaseDname.length} venues with rooftop-bar/sky-bar name pattern but category≠bar`);
  for (const v of phaseDname) {
    console.log(`    [RE-CAT] ${v.city?.name ?? '?'} / ${v.category}→bar  ${v.name}`);
    if (APPLY) await venueRepo.update({ id: v.id }, { category: 'bar' as Cat });
  }

  // ── PHASE E: Low-quality soft-delete ──
  console.log('\n── Phase E: soft-delete low-quality (reviews<100 AND rating<4.0, non-curated) ──');
  const phaseE = await venueRepo.createQueryBuilder('v')
    .leftJoinAndSelect('v.city', 'c')
    .where('v.deletedAt IS NULL')
    .andWhere('v.isPublished = true')
    .andWhere(`v.source <> 'curated'`)
    .andWhere('COALESCE(v.externalReviewCount, 0) < 100')
    .andWhere('COALESCE(v.rating, 0) < 4.0')
    .getMany();
  console.log(`  Found ${phaseE.length} low-quality venues`);
  for (const v of phaseE) {
    console.log(`    [DELETE] ${v.city?.name ?? '?'} / ${v.category} / ${v.name}  reviews=${v.externalReviewCount} rating=${v.rating}`);
  }
  if (APPLY && phaseE.length > 0) {
    await venueRepo.softDelete({ id: In(phaseE.map((v) => v.id)) });
    console.log(`  ✓ Soft-deleted ${phaseE.length}`);
  }

  console.log('\n=== Summary ===');
  console.log(`  Phase A (non-POI deleted):     ${phaseA.length}`);
  console.log(`  Phase B (hotels deleted):      ${phaseB.length}`);
  console.log(`  Phase C (beach re-categorized): ${updates.length}`);
  console.log(`  Phase D1 (tag normalized):     ${phaseDtag.length}`);
  console.log(`  Phase D2 (name→bar category):  ${phaseDname.length}`);
  console.log(`  Phase E (low-quality deleted): ${phaseE.length}`);
  console.log(APPLY ? '\n✓ APPLIED' : '\n(dry-run — no changes committed)');

  await ds.destroy();
}

main().catch((err) => { console.error(err); process.exit(1); });
