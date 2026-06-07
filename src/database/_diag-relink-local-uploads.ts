import 'reflect-metadata';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { promises as fs } from 'fs';
import { basename, join, resolve } from 'path';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';

dotenv.config();

// USAGE
//   npx ts-node src/database/_diag-relink-local-uploads.ts <slug>
//
// For venues whose images[] points at api.homnaydidau.xyz URLs that 404
// because the file only exists on the LOCAL upload disk (the dev-vs-prod
// disk-vs-URL mismatch bug). Reads each file from UPLOAD_DIR, posts to
// prod BE via /admin/uploads, replaces the URL.

const DISK_PATH = process.env.UPLOAD_DIR ?? './uploads';
const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';

async function upload(filePath: string): Promise<string> {
  const bytes = await fs.readFile(filePath);
  const fd = new FormData();
  fd.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: 'image/webp' }),
    basename(filePath),
  );
  const res = await axios.post<{ data?: { url?: string }; url?: string }>(
    `${BACKEND}/admin/uploads`,
    fd,
    {
      headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      maxBodyLength: Infinity,
      timeout: 30_000,
    },
  );
  const url = res.data?.data?.url ?? res.data?.url;
  if (!url) throw new Error('no url in response');
  return url;
}

async function main() {
  if (!BACKEND || !ADMIN_JWT) {
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required');
  }
  const slug = process.argv[2];
  if (!slug) {
    throw new Error('Pass a venue slug');
  }
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  try {
    const repo = ds.getRepository(Venue);
    const venue = await repo.findOne({ where: { slug } });
    if (!venue) throw new Error(`venue not found: ${slug}`);
    console.log(`▶ ${venue.slug} — ${venue.name}`);

    const out: string[] = [];
    let relinked = 0;
    let skipped = 0;
    for (const u of venue.images) {
      const filename = (() => {
        try {
          return basename(new URL(u).pathname);
        } catch {
          return basename(u);
        }
      })();
      const localPath = join(resolve(DISK_PATH), filename);
      try {
        await fs.access(localPath);
      } catch {
        out.push(u);
        continue;
      }
      try {
        process.stdout.write(`  ↑ ${filename} → `);
        const realUrl = await upload(localPath);
        console.log(realUrl);
        out.push(realUrl);
        relinked += 1;
      } catch (e) {
        skipped += 1;
        console.log(`✗ ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    venue.images = out;
    await repo.save(venue);
    console.log(`\n✓ relinked=${relinked} skipped=${skipped}`);
  } finally {
    await ds.destroy();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
