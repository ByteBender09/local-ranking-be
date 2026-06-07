import 'reflect-metadata';
import * as dotenv from 'dotenv';
import axios from 'axios';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { City } from './entities';
import { dataSourceOptions } from './data-source';

dotenv.config();

// USAGE
//   npx ts-node src/database/_diag-rehost-city-cover.ts <slug>
//   npx ts-node src/database/_diag-rehost-city-cover.ts --all
// ENV: BACKEND_PUBLIC_URL, IMPORT_ADMIN_JWT

const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DOWNLOAD_HEADERS = {
  'User-Agent': BROWSER_UA,
  Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
};

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function downloadWithBackoff(url: string): Promise<ArrayBuffer> {
  const delays = [0, 2_000, 8_000, 30_000];
  let lastErr: unknown;
  for (const wait of delays) {
    if (wait) await sleep(wait);
    try {
      const img = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 30_000,
        headers: DOWNLOAD_HEADERS,
      });
      return img.data;
    } catch (e) {
      lastErr = e;
      if (!axios.isAxiosError(e)) throw e;
      const status = e.response?.status;
      if (status !== 429 && status !== 503) throw e;
    }
  }
  throw lastErr;
}

async function ingestViaBackend(url: string): Promise<string> {
  const buf = await downloadWithBackoff(url);
  const webp = await sharp(Buffer.from(buf))
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  const fd = new FormData();
  fd.append(
    'file',
    new Blob([new Uint8Array(webp)], { type: 'image/webp' }),
    'cover.webp',
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
  const out = res.data?.data?.url ?? res.data?.url;
  if (!out) throw new Error('no url in upload response');
  return out;
}

async function patchCityCover(slug: string, coverImage: string): Promise<void> {
  await axios.patch(
    `${BACKEND}/admin/cities/${encodeURIComponent(slug)}`,
    { coverImage },
    {
      headers: { Authorization: `Bearer ${ADMIN_JWT}` },
      timeout: 30_000,
    },
  );
}

async function rehostCity(city: City): Promise<boolean> {
  const url = (city.coverImage ?? '').trim();
  console.log(`▶ ${city.slug} — ${city.name}`);
  if (!url) {
    console.log('  (no coverImage)');
    return false;
  }
  if (isOwn(url)) {
    console.log('  already on own domain — skip');
    return false;
  }
  process.stdout.write(`  ⏳ ${url.slice(0, 80)} → `);
  const hosted = await ingestViaBackend(url);
  console.log(hosted);
  await patchCityCover(city.slug, hosted);
  city.coverImage = hosted;
  return true;
}

async function main(): Promise<void> {
  if (!BACKEND || !ADMIN_JWT) {
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required');
  }
  const arg = process.argv[2];
  if (!arg) {
    console.error('Pass a city slug or --all');
    process.exit(1);
  }
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  try {
    const repo = ds.getRepository(City);
    let cities: City[];
    if (arg === '--all') {
      const all = await repo.find();
      cities = all.filter((c) => c.coverImage && !isOwn(c.coverImage));
    } else {
      const c = await repo.findOne({ where: { slug: arg } });
      if (!c) throw new Error(`city not found: ${arg}`);
      cities = [c];
    }
    console.log(`Processing ${cities.length} city/cities…\n`);
    let updated = 0;
    let failed = 0;
    for (const c of cities) {
      try {
        if (await rehostCity(c)) {
          updated += 1;
        }
      } catch (e) {
        failed += 1;
        console.log(`  ✗ ${e instanceof Error ? e.message : String(e)}`);
      }
      console.log('');
    }
    console.log(
      `✓ Done. cities=${cities.length} updated=${updated} failed=${failed}`,
    );
  } finally {
    await ds.destroy();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
