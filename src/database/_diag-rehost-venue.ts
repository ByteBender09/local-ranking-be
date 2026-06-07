import 'reflect-metadata';
import * as dotenv from 'dotenv';
import axios from 'axios';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { Venue } from './entities';
import { dataSourceOptions } from './data-source';

dotenv.config();

// USAGE
//   npx ts-node src/database/_diag-rehost-venue.ts <slug>        (single)
//   npx ts-node src/database/_diag-rehost-venue.ts --all         (every venue with external imgs)
// ENV: BACKEND_PUBLIC_URL, IMPORT_ADMIN_JWT

const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';

function isOwn(url: string): boolean {
  try {
    const u = new URL(url, 'http://_');
    if (u.hostname === '_') return u.pathname.startsWith('/uploads/');
    return (
      (u.hostname.endsWith('homnaydidau.xyz') ||
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1') &&
      u.pathname.startsWith('/uploads/')
    );
  } catch {
    return false;
  }
}

async function ingestViaBackend(url: string): Promise<string> {
  const img = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  });
  const webp = await sharp(Buffer.from(img.data))
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(webp)], { type: 'image/webp' }), 'i.webp');
  const res = await axios.post<{ data?: { url?: string }; url?: string }>(
    `${BACKEND}/admin/uploads`,
    fd,
    {
      headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      maxBodyLength: Infinity,
      timeout: 30_000,
    },
  );
  const out = res.data?.data?.url ?? res.data?.url;
  if (!out) throw new Error('no url in upload response');
  return out;
}

async function rehostVenue(venue: Venue): Promise<{ rehosted: number; skipped: number }> {
  const out: string[] = [];
  let rehosted = 0;
  let skipped = 0;
  console.log(`▶ ${venue.slug} — ${venue.name} (${venue.images.length} imgs)`);
  for (const url of venue.images) {
    const trimmed = (url ?? '').trim();
    if (!trimmed) continue;
    if (isOwn(trimmed)) {
      out.push(trimmed);
      continue;
    }
    try {
      process.stdout.write(`  ⏳ ${trimmed.slice(0, 80)} → `);
      const hosted = await ingestViaBackend(trimmed);
      console.log(hosted);
      out.push(hosted);
      rehosted += 1;
    } catch (e) {
      skipped += 1;
      console.log(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  venue.images = out;
  return { rehosted, skipped };
}

async function main() {
  if (!BACKEND || !ADMIN_JWT) {
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required');
  }
  const arg = process.argv[2];
  if (!arg) {
    console.error('Pass a venue slug or --all');
    process.exit(1);
  }
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  try {
    const repo = ds.getRepository(Venue);
    let venues: Venue[];
    if (arg === '--all') {
      venues = await repo.find();
      venues = venues.filter((v) => (v.images ?? []).some((u) => !isOwn(u)));
    } else {
      const v = await repo.findOne({ where: { slug: arg } });
      if (!v) throw new Error(`venue not found: ${arg}`);
      venues = [v];
    }
    console.log(`Processing ${venues.length} venue(s)…\n`);
    let totalRehosted = 0;
    let totalSkipped = 0;
    for (const v of venues) {
      const { rehosted, skipped } = await rehostVenue(v);
      await repo.save(v);
      totalRehosted += rehosted;
      totalSkipped += skipped;
      console.log('');
    }
    console.log(`✓ Done. venues=${venues.length} rehosted=${totalRehosted} skipped=${totalSkipped}`);
  } finally {
    await ds.destroy();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
