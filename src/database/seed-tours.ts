import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, Repository } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Brand, City, Tour, TourStop } from './entities';
import { TOUR_BRANDS, TOUR_SEEDS, type BrandSeed } from './seed-data/tour-brands';

dotenv.config();

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);

// Brands are standalone catalog objects (not user accounts). Keyed by name.
async function upsertBrand(
  repo: Repository<Brand>,
  brand: BrandSeed,
): Promise<Brand> {
  let row = await repo.findOne({ where: { name: brand.brandName } });
  if (!row) {
    row = repo.create({
      name: brand.brandName,
      shortName: brand.brandShortName,
      logoUrl: brand.brandLogoUrl,
      description: brand.brandDescription,
      websiteUrl: brand.brandWebsiteUrl,
      contactEmail: brand.brandContactEmail,
      verified: brand.emailVerified,
      verifiedAt: brand.emailVerified ? new Date() : null,
    });
    return repo.save(row);
  }

  // Re-apply seed branding info so re-runs pick up edits to tour-brands.ts.
  let dirty = false;
  if (row.shortName !== brand.brandShortName) {
    row.shortName = brand.brandShortName;
    dirty = true;
  }
  if (row.logoUrl !== brand.brandLogoUrl) {
    row.logoUrl = brand.brandLogoUrl;
    dirty = true;
  }
  if (row.description !== brand.brandDescription) {
    row.description = brand.brandDescription;
    dirty = true;
  }
  if (row.websiteUrl !== brand.brandWebsiteUrl) {
    row.websiteUrl = brand.brandWebsiteUrl;
    dirty = true;
  }
  if (row.contactEmail !== brand.brandContactEmail) {
    row.contactEmail = brand.brandContactEmail;
    dirty = true;
  }
  if (brand.emailVerified && !row.verified) {
    row.verified = true;
    row.verifiedAt = new Date();
    dirty = true;
  }
  return dirty ? repo.save(row) : row;
}

async function uniqueTourSlug(
  ds: DataSource,
  base: string,
): Promise<string> {
  const repo = ds.getRepository(Tour);
  let candidate = base;
  let i = 1;
  while (await repo.exists({ where: { slug: candidate } })) {
    i += 1;
    candidate = `${base}-${i}`;
  }
  return candidate;
}

async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  console.log('Connected. Seeding tour brands + tours...');

  const cityRepo = ds.getRepository(City);
  const tourRepo = ds.getRepository(Tour);
  const tourStopRepo = ds.getRepository(TourStop);
  const brandRepo = ds.getRepository(Brand);

  const brandsByHandle = new Map<string, Brand>();
  for (const b of TOUR_BRANDS) {
    const brand = await upsertBrand(brandRepo, b);
    brandsByHandle.set(b.handle, brand);
  }
  console.log(`✓ Brands: ${brandsByHandle.size}`);

  // Build the denormalised provider blob from a brand.
  const providerOf = (b: Brand) => ({
    name: b.name,
    shortName: b.shortName,
    verified: b.verified,
    logoUrl: b.logoUrl ?? null,
  });

  let created = 0;
  let skipped = 0;
  for (const t of TOUR_SEEDS) {
    const brand = brandsByHandle.get(t.brandHandle);
    if (!brand) {
      console.warn(`  ⚠ unknown brand handle "${t.brandHandle}", skip`);
      skipped += 1;
      continue;
    }
    const city = await cityRepo.findOne({ where: { slug: t.citySlug } });
    if (!city) {
      console.warn(`  ⚠ unknown city slug "${t.citySlug}", skip`);
      skipped += 1;
      continue;
    }

    const existing = await tourRepo.findOne({
      where: { brandId: brand.id, title: t.title },
      relations: { stops: true },
    });

    if (existing) {
      // Re-runs now refresh image/gallery/description fields so admins can
      // ship new tour photos by editing tour-brands.ts and re-running the
      // seed — instead of having to touch each tour through the admin UI.
      let dirty = false;
      if (existing.image !== t.image) {
        existing.image = t.image;
        dirty = true;
      }
      const newImages = t.images ?? [];
      const sameImages =
        existing.images?.length === newImages.length &&
        existing.images.every((u, i) => u === newImages[i]);
      if (!sameImages) {
        existing.images = newImages;
        dirty = true;
      }
      if (existing.description !== t.description) {
        existing.description = t.description;
        dirty = true;
      }
      if (existing.bookingUrl !== t.bookingUrl) {
        existing.bookingUrl = t.bookingUrl;
        dirty = true;
      }
      // Re-sync the denormalised provider blob from the brand.
      const nextProvider = providerOf(brand);
      const sameProvider =
        existing.provider &&
        existing.provider.name === nextProvider.name &&
        existing.provider.shortName === nextProvider.shortName &&
        existing.provider.verified === nextProvider.verified &&
        (existing.provider.logoUrl ?? null) === nextProvider.logoUrl;
      if (!sameProvider) {
        existing.provider = nextProvider;
        dirty = true;
      }
      // Ensure a single-city itinerary exists for legacy seed rows.
      if (!existing.stops || existing.stops.length === 0) {
        existing.stops = [
          tourStopRepo.create({ order: 0, cityId: city.id, venueId: null }),
        ];
        existing.cityId = city.id;
        existing.scope = 'intra_city';
        dirty = true;
      }
      if (dirty) await tourRepo.save(existing);
      skipped += 1;
      continue;
    }

    const baseSlug = `${slugify(t.title)}-${city.slug}`;
    const slug = await uniqueTourSlug(ds, baseSlug);

    const tour = tourRepo.create({
      slug,
      title: t.title,
      cityId: city.id,
      scope: 'intra_city',
      // Seed tours are single-city, city-only itineraries (no specific venue).
      stops: [tourStopRepo.create({ order: 0, cityId: city.id, venueId: null })],
      category: t.category,
      durationHours: t.durationHours,
      priceVnd: t.priceVnd,
      image: t.image,
      images: t.images ?? [],
      description: t.description,
      bookingUrl: t.bookingUrl,
      highlights: t.highlights,
      venueIds: [],
      promotions: [],
      rating: 0,
      reviewCount: 0,
      brandId: brand.id,
      ownerId: null,
      provider: providerOf(brand),
      isPublished: true,
    });
    await tourRepo.save(tour);
    created += 1;
  }
  console.log(`✓ Tours created: ${created}, skipped (already exist): ${skipped}`);

  await ds.destroy();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
