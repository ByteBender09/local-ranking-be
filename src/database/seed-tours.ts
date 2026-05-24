import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, Repository } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { City, Tour, User } from './entities';
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

async function upsertBrandUser(
  repo: Repository<User>,
  brand: BrandSeed,
): Promise<User> {
  let row = await repo.findOne({ where: { handle: brand.handle } });
  if (!row) {
    row = repo.create({
      handle: brand.handle,
      name: brand.name,
      role: 'business',
      email: brand.brandContactEmail,
      avatar: brand.avatar,
      bio: brand.brandDescription,
      socials: {},
      bookingEnabled: false,
      checkInCount: 0,
      followerCount: 0,
      brandName: brand.brandName,
      brandShortName: brand.brandShortName,
      brandLogoUrl: brand.brandLogoUrl,
      brandDescription: brand.brandDescription,
      brandWebsiteUrl: brand.brandWebsiteUrl,
      brandContactEmail: brand.brandContactEmail,
      brandEmailVerified: brand.emailVerified,
      brandEmailVerifiedAt: brand.emailVerified ? new Date() : null,
    });
    return repo.save(row);
  }

  // Re-running the seed shouldn't clobber admin tweaks to identity fields
  // (name, email, avatar). Only branding info that came from the seed is
  // re-applied so the latest URL / description shows up after a re-run.
  let dirty = false;
  if (row.role !== 'business' && row.role !== 'admin') {
    row.role = 'business';
    dirty = true;
  }
  if (row.brandName !== brand.brandName) {
    row.brandName = brand.brandName;
    dirty = true;
  }
  if (row.brandShortName !== brand.brandShortName) {
    row.brandShortName = brand.brandShortName;
    dirty = true;
  }
  if (row.brandLogoUrl !== brand.brandLogoUrl) {
    row.brandLogoUrl = brand.brandLogoUrl;
    dirty = true;
  }
  if (row.brandDescription !== brand.brandDescription) {
    row.brandDescription = brand.brandDescription;
    dirty = true;
  }
  if (row.brandWebsiteUrl !== brand.brandWebsiteUrl) {
    row.brandWebsiteUrl = brand.brandWebsiteUrl;
    dirty = true;
  }
  if (row.brandContactEmail !== brand.brandContactEmail) {
    row.brandContactEmail = brand.brandContactEmail;
    dirty = true;
  }
  if (brand.emailVerified && !row.brandEmailVerified) {
    row.brandEmailVerified = true;
    row.brandEmailVerifiedAt = new Date();
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
  const userRepo = ds.getRepository(User);

  const brandUsers = new Map<string, User>();
  for (const b of TOUR_BRANDS) {
    const u = await upsertBrandUser(userRepo, b);
    brandUsers.set(b.handle, u);
  }
  console.log(`✓ Brands: ${brandUsers.size}`);

  let created = 0;
  let skipped = 0;
  for (const t of TOUR_SEEDS) {
    const owner = brandUsers.get(t.brandHandle);
    if (!owner) {
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
      where: { ownerId: owner.id, title: t.title },
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
      // Re-sync the denormalised provider blob — older rows seeded before
      // logoUrl was added still have an incomplete provider object.
      const nextProvider = {
        name: owner.brandName ?? owner.name,
        shortName:
          owner.brandShortName ?? owner.handle.slice(0, 6).toUpperCase(),
        verified: owner.brandEmailVerified,
        logoUrl: owner.brandLogoUrl ?? null,
      };
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
      ownerId: owner.id,
      provider: {
        name: owner.brandName ?? owner.name,
        shortName:
          owner.brandShortName ?? owner.handle.slice(0, 6).toUpperCase(),
        verified: owner.brandEmailVerified,
        logoUrl: owner.brandLogoUrl ?? null,
      },
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
