import 'reflect-metadata';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

dotenv.config();

// Scans the upload volume for files that are no longer referenced by any
// row in the DB (venue.images, brand.logoUrl/coverImage, tour.image,
// user.avatar, city.coverImage, check_in.photos, review.photos) and
// unlinks them via the /admin/uploads/by-urls endpoint.
//
// Use after a bulk hard-delete (e.g. _diag-hard-delete-suspicious.ts) when
// the venue rows are gone but the CDN files were left behind because the
// backend endpoint hadn't deployed yet.
//
// Requires:
//   - Backend deployed with DELETE /admin/uploads/by-urls (uploads.controller)
//   - GET /admin/uploads/list endpoint exposing the volume's file list
//     (added in the same patch; without it this script can only show DB
//     references, not orphans).
//
// SAFETY: dry-run by default. Pass --apply.
//
//   npx ts-node src/database/_diag-cleanup-orphan-uploads.ts                  (dry-run)
//   npx ts-node src/database/_diag-cleanup-orphan-uploads.ts --apply
//   npx ts-node src/database/_diag-cleanup-orphan-uploads.ts --apply --batch-size=100

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const FLAGS = {
  apply: process.argv.includes('--apply'),
  batchSize: parseInt(arg('batch-size', '50'), 10),
};

const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';

// Pull every image URL still referenced anywhere in the DB. Anything on
// disk that's NOT in this set is an orphan.
async function collectReferencedFilenames(ds: DataSource): Promise<Set<string>> {
  const refs = new Set<string>();
  const addUrl = (url: unknown): void => {
    if (typeof url !== 'string' || !url) return;
    try {
      const p = url.startsWith('/') ? url : new URL(url).pathname;
      if (!p.startsWith('/uploads/')) return;
      const fname = p.slice('/uploads/'.length);
      if (fname && !fname.includes('/')) refs.add(fname);
    } catch { /* skip malformed */ }
  };

  // venues.images (array)
  const v = await ds.query<{ images: string[] }[]>(
    `SELECT images FROM venues WHERE images IS NOT NULL`,
  );
  for (const r of v) for (const u of r.images ?? []) addUrl(u);

  // brands.logoUrl + coverImage
  try {
    const b = await ds.query<{ logo: string | null; cover: string | null }[]>(
      `SELECT logo_url AS logo, cover_image AS cover FROM brands`,
    );
    for (const r of b) { addUrl(r.logo); addUrl(r.cover); }
  } catch { /* table may not exist in dev */ }

  // tours.image
  try {
    const t = await ds.query<{ image: string | null }[]>(`SELECT image FROM tours`);
    for (const r of t) addUrl(r.image);
  } catch { /* */ }

  // users.avatar
  try {
    const u = await ds.query<{ avatar: string | null }[]>(`SELECT avatar FROM users WHERE avatar IS NOT NULL`);
    for (const r of u) addUrl(r.avatar);
  } catch { /* */ }

  // cities.cover_image
  try {
    const c = await ds.query<{ ci: string | null }[]>(`SELECT cover_image AS ci FROM cities WHERE cover_image IS NOT NULL`);
    for (const r of c) addUrl(r.ci);
  } catch { /* */ }

  // check_ins.photos (array)
  try {
    const ci = await ds.query<{ photos: string[] }[]>(`SELECT photos FROM check_ins WHERE photos IS NOT NULL`);
    for (const r of ci) for (const u of r.photos ?? []) addUrl(u);
  } catch { /* */ }

  // reviews.photos (array, added 2026-06-08)
  try {
    const rv = await ds.query<{ photos: string[] }[]>(`SELECT photos FROM reviews WHERE photos IS NOT NULL`);
    for (const r of rv) for (const u of r.photos ?? []) addUrl(u);
  } catch { /* */ }

  // venues.image_ingestion_status.pending — files queued for ingestion
  try {
    const pending = await ds.query<{ pending: string[] }[]>(
      `SELECT image_ingestion_status->'pending' AS pending FROM venues WHERE image_ingestion_status IS NOT NULL`,
    );
    for (const r of pending) for (const u of r.pending ?? []) addUrl(u);
  } catch { /* */ }

  return refs;
}

async function listVolumeFiles(): Promise<string[]> {
  const res = await axios.get<{ files: string[] }>(
    `${BACKEND}/admin/uploads/list`,
    {
      headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      timeout: 60000,
    },
  );
  return res.data?.files ?? [];
}

async function unlinkFiles(urls: string[]): Promise<{ removed: number; submitted: number }> {
  if (urls.length === 0) return { removed: 0, submitted: 0 };
  const res = await axios.delete<{ removed: number; submitted: number }>(
    `${BACKEND}/admin/uploads/by-urls`,
    {
      data: { urls },
      headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      timeout: 60000,
    },
  );
  return res.data;
}

async function main(): Promise<void> {
  if (!BACKEND || !ADMIN_JWT) {
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required');
  }
  console.log(`\n${FLAGS.apply ? '🔴 APPLY' : '🟡 DRY-RUN'} — scan volume for orphan upload files\n`);

  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();

  console.log('Step 1: collect referenced filenames from DB…');
  const referenced = await collectReferencedFilenames(ds);
  console.log(`  ${referenced.size} files referenced across all DB tables`);

  console.log('\nStep 2: list files on volume…');
  let onDisk: string[];
  try {
    onDisk = await listVolumeFiles();
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (status === 404) {
      console.error(`  ✗ GET /admin/uploads/list returns 404 — deploy backend with the new endpoint first.`);
    } else {
      console.error(`  ✗ ${String(e).slice(0, 200)}`);
    }
    await ds.destroy();
    process.exit(1);
  }
  console.log(`  ${onDisk.length} files on volume`);

  const orphans = onDisk.filter((f) => !referenced.has(f));
  console.log(`\nOrphans: ${orphans.length} files`);
  if (orphans.length === 0) {
    await ds.destroy();
    return;
  }
  console.log('First 10:');
  for (const f of orphans.slice(0, 10)) console.log(`  - ${f}`);
  if (orphans.length > 10) console.log(`  … and ${orphans.length - 10} more`);

  if (!FLAGS.apply) {
    console.log(`\n(dry-run — pass --apply to unlink)`);
    await ds.destroy();
    return;
  }

  const urls = orphans.map((f) => `${BACKEND}/uploads/${f}`);
  console.log('\nUnlinking…');
  let removed = 0;
  for (let i = 0; i < urls.length; i += FLAGS.batchSize) {
    const batch = urls.slice(i, i + FLAGS.batchSize);
    try {
      const res = await unlinkFiles(batch);
      removed += res.removed;
      process.stdout.write(`  ${i + batch.length}/${urls.length} — ${removed} unlinked\r`);
    } catch (e) {
      console.log(`\n  ✗ batch failed: ${String(e).slice(0, 120)}`);
    }
  }
  console.log(`\n✓ ${removed}/${urls.length} files removed`);
  await ds.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
