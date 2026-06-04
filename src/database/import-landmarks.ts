import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { City, Venue } from './entities';
import { LANDMARK_VENUES } from './seed-data/landmark-venues';
import { imagesForVenue } from './seed-data/images';

dotenv.config();

// Imports the researched iconic landmarks + signature food (seed-data/
// landmark-venues.ts) into the existing cities. Mirrors seed-venues.ts:
// dedupe by slug, deterministic rating/upvotes so re-runs are idempotent,
// category-pool images, source = 'curated'. Safe to re-run.

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function seedRandom(slug: string, max: number, min = 50): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return min + (h % (max - min));
}

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  console.log('Connected. Importing curated landmarks...');

  const cityRepo = ds.getRepository(City);
  const venueRepo = ds.getRepository(Venue);

  let created = 0;
  let skipped = 0;
  let missingCity = 0;

  for (const [citySlug, venues] of Object.entries(LANDMARK_VENUES)) {
    const city = await cityRepo.findOne({ where: { slug: citySlug } });
    if (!city) {
      console.warn(`⚠ City "${citySlug}" not found — skipping ${venues.length} venues`);
      missingCity += venues.length;
      continue;
    }

    let cityCreated = 0;
    for (const v of venues) {
      const slug = `${slugify(v.name)}-${citySlug}`;
      const existing = await venueRepo.findOne({ where: { slug } });
      if (existing) {
        skipped++;
        continue;
      }

      await venueRepo.save(
        venueRepo.create({
          slug,
          name: v.name,
          category: v.category,
          cityId: city.id,
          district: v.district,
          address: v.address,
          description: v.description,
          images: imagesForVenue(v.category, slug),
          tags: v.tags,
          hours: v.hours,
          priceRange: v.priceRange,
          lat: v.lat,
          lng: v.lng,
          rating: 4.0 + seedRandom(slug, 90) / 100, // 4.50 - 4.90
          reviewCount: 0,
          upvotes: seedRandom(slug, 2500, 100),
          isPublished: true,
          source: 'curated',
        }),
      );
      created++;
      cityCreated++;
    }
    console.log(`  ${citySlug}: +${cityCreated} (of ${venues.length})`);
  }

  console.log(`\n✓ Created: ${created}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  if (missingCity > 0) console.log(`  ⚠ Missing cities: ${missingCity} venues skipped`);
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
