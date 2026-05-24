import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { City, Venue } from './entities';
import { REAL_VENUES } from './seed-data/venues';
import { imagesForVenue } from './seed-data/images';

dotenv.config();

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Pseudo-random for upvote distribution — deterministic per slug so re-runs
// produce identical numbers (no churn during dev).
function seedRandom(slug: string, max: number, min = 50): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return min + (h % (max - min));
}

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: true });
  await ds.initialize();
  console.log('Connected. Loading curated venues...');

  const cityRepo = ds.getRepository(City);
  const venueRepo = ds.getRepository(Venue);

  let created = 0;
  let skipped = 0;
  let missingCity = 0;

  for (const [citySlug, venues] of Object.entries(REAL_VENUES)) {
    const city = await cityRepo.findOne({ where: { slug: citySlug } });
    if (!city) {
      console.warn(`⚠ City "${citySlug}" not found — skipping ${venues.length} venues`);
      missingCity += venues.length;
      continue;
    }

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
          // Believable starting popularity — deterministic so reseed = same.
          rating: 4.0 + (seedRandom(slug, 90) / 100), // 4.50 - 4.90
          reviewCount: 0,
          upvotes: seedRandom(slug, 2500, 100),
          isPublished: true,
        }),
      );
      created++;
    }
  }

  console.log(`\n✓ Created: ${created}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  if (missingCity > 0) {
    console.log(
      `  ⚠ Missing cities: ${missingCity} venues skipped — run \`npm run seed\` first to bootstrap cities.`,
    );
  }
  console.log(
    `\nDone. Venues are managed via /admin/cities/:slug from here on.`,
  );
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
