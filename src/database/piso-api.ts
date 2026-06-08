import {
  existsSync, readFileSync, writeFileSync, mkdirSync, statSync, appendFileSync,
} from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';
import axios from 'axios';
import sharp from 'sharp';
import type { EntityManager } from 'typeorm';
import { User } from './entities';

// Shared PISO client for the 2 piso-* command scripts (piso-import.ts +
// piso-verify.ts). Keep all HTTP / cache / image / reviewer logic here so
// the command files focus purely on their flow:
//   - file-based response cache (search keyed by query+lat+lng,
//     place keyed by data_id)
//   - 429 exponential-backoff retry for both /place + /search and the
//     image-upload step
//   - WebP-converted image upload through the backend's /admin/uploads
//     route (which writes to the Railway volume)
//   - synthetic reviewer user creation with handle dedupe
//   - tee-style logging (stdout + per-run log file)

// ── Types ────────────────────────────────────────────────────────────────────
export interface PisoMedia { id?: string; url?: string }
export interface PisoSearchItem {
  data_id?: string;
  place_id?: string;
  title?: string;
  type?: string;
  rating?: number;
  reviews?: number;
  location?: { latitude?: number; longitude?: number; address?: { full?: string } };
  opening_hours?: { day: string; hours: string }[];
  contacts?: { phone?: string; website?: string };
}
export interface PisoReview {
  review_id?: string;
  author_name?: string;
  author_profile_pic?: string;
  rating?: number;
  relative_date?: string;
  text?: string;
  photos?: PisoMedia[];
}
export interface PisoPlace extends PisoSearchItem {
  description?: string;
  photos?: { category_id?: string; media?: PisoMedia[] }[];
  review_list?: PisoReview[];
  google_maps_url?: string;
  features?: Record<string, string[]>;
}

// ── Env / config (read at import time) ───────────────────────────────────────
export const API_KEY = process.env.PISOMAP_API_KEY ?? '';
export const API_BASE = 'https://api.pisomap.tech/api/maps';
export const BACKEND = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
export const ADMIN_JWT = process.env.IMPORT_ADMIN_JWT ?? '';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── Logger ───────────────────────────────────────────────────────────────────
let CURRENT_LOG_FILE: string | null = null;
export function setLogFile(file: string | null): void { CURRENT_LOG_FILE = file; }
export function log(line: string): void {
  const stamped = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  console.log(stamped);
  if (CURRENT_LOG_FILE) {
    try { appendFileSync(CURRENT_LOG_FILE, stamped + '\n'); } catch { /* no-op */ }
  }
}

// ── Cache (file-based, shared across runs) ───────────────────────────────────
export const CACHE_DIR = resolve(process.cwd(), 'piso-cache');
const CACHE_SEARCH_DIR = resolve(CACHE_DIR, 'search');
const CACHE_PLACE_DIR = resolve(CACHE_DIR, 'place');

let CACHE_TTL_MS = 30 * 86400 * 1000;
let CACHE_DISABLED = false;
export function setCacheTtlDays(days: number): void { CACHE_TTL_MS = days * 86400 * 1000; }
export function disableCache(): void { CACHE_DISABLED = true; }

export function ensureCacheDirs(): void {
  if (CACHE_DISABLED) return;
  for (const d of [CACHE_DIR, CACHE_SEARCH_DIR, CACHE_PLACE_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

function cacheKey(parts: (string | number)[]): string {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

function readJson<T>(file: string): T | null {
  if (CACHE_DISABLED) return null;
  if (!existsSync(file)) return null;
  try {
    if (Date.now() - statSync(file).mtimeMs > CACHE_TTL_MS) return null;
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch { return null; }
}
function writeJson<T>(file: string, value: T): void {
  if (CACHE_DISABLED) return;
  try { writeFileSync(file, JSON.stringify(value)); } catch { /* best-effort */ }
}

export const cacheStats = { searchHit: 0, searchMiss: 0, placeHit: 0, placeMiss: 0 };

// ── HTTP retry wrapper ──────────────────────────────────────────────────────
// 429 = throttled → exponential backoff up to ~60s; permanent 4xx breaks
// immediately; transient 5xx + network errors retry with linear backoff.
export async function withRetry<T>(
  fn: () => Promise<T>, label: string, tries = 5,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (status && status < 500 && status !== 429) break;
      // 429 needs a longer pause than transient 5xx — the throttler bucket
      // refills slowly. Linear-then-bumped backoff: 5s, 8s, 13s, 21s, 34s.
      const wait = status === 429 ? 5000 * Math.pow(1.5, i) : 1000 * (i + 1);
      await sleep(wait);
    }
  }
  throw new Error(`${label} failed: ${String(last)}`);
}

// ── API calls (cached) ───────────────────────────────────────────────────────
export async function apiSearch(
  q: string, lat: number, lng: number,
): Promise<PisoSearchItem[]> {
  const file = resolve(CACHE_SEARCH_DIR, `${cacheKey([q, lat.toFixed(4), lng.toFixed(4)])}.json`);
  const cached = readJson<PisoSearchItem[]>(file);
  if (cached) { cacheStats.searchHit++; return cached; }
  cacheStats.searchMiss++;
  const r = await withRetry(
    () => axios.get<{ local_result?: PisoSearchItem[] }>(`${API_BASE}/search`, {
      params: { q, lat, lng }, headers: { 'x-api-key': API_KEY }, timeout: 30000,
    }), `search "${q}"`);
  const items = r.data?.local_result ?? [];
  writeJson(file, items);
  return items;
}

export async function apiPlace(
  dataId: string, lat: number, lng: number,
): Promise<PisoPlace | null> {
  const file = resolve(CACHE_PLACE_DIR, `${dataId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  const cached = readJson<PisoPlace>(file);
  if (cached) { cacheStats.placeHit++; return cached; }
  cacheStats.placeMiss++;
  const r = await withRetry(
    () => axios.get<{ place_result?: PisoPlace }>(`${API_BASE}/place`, {
      params: { data_id: dataId, lat, lng }, headers: { 'x-api-key': API_KEY }, timeout: 30000,
    }), `place ${dataId.slice(0, 16)}`);
  const place = r.data?.place_result ?? null;
  if (place) writeJson(file, place);
  return place;
}

export function flatMedia(p: PisoPlace): string[] {
  const urls: string[] = [];
  for (const g of p.photos ?? []) for (const m of g.media ?? []) if (m.url) urls.push(m.url);
  return urls;
}

export function compactHours(oh?: { day: string; hours: string }[]): string {
  if (!oh || oh.length === 0) return '';
  const h = oh[0].hours ?? '';
  const m = h.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
  if (m) return `${m[1]} - ${m[2]}`.slice(0, 64);
  if (/24|cả ngày/i.test(h)) return '24/7';
  return '';
}

// ── Image upload (download → sharp → /admin/uploads) ─────────────────────────
export async function uploadImage(url: string): Promise<string> {
  const img = await withRetry(
    () => axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 30000 }),
    'download image', 3);
  const webp = await sharp(Buffer.from(img.data))
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const up = await withRetry(() => {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(webp)], { type: 'image/webp' }), 'g.webp');
    return axios.post<{ data?: { url?: string }; url?: string }>(
      `${BACKEND}/admin/uploads`, fd, {
        headers: { Authorization: `Bearer ${ADMIN_JWT}` },
        maxBodyLength: Infinity, timeout: 30000,
      });
  }, 'upload', 6);
  const out = up.data?.data?.url ?? up.data?.url;
  if (!out) throw new Error('upload returned no url');
  return out;
}

// ── Synthetic reviewer (Google-scraped author → User row) ────────────────────
export async function getOrCreateReviewer(
  m: EntityManager,
  authorName: string,
  avatar: string,
  cache: Map<string, string>,
): Promise<string> {
  const clean = (authorName || 'Khách Google').trim().slice(0, 60);
  const handle = ('g-' + slugify(clean)).slice(0, 40) || 'g-khach';
  if (cache.has(handle)) return cache.get(handle)!;
  let user = await m.findOne(User, { where: { handle } });
  if (!user) {
    user = await m.save(m.create(User, {
      handle, name: clean, role: 'user', isSynthetic: true,
      avatar: avatar || `https://picsum.photos/seed/${handle}/200/200`,
      bio: '', socials: {}, bookingEnabled: false,
      checkInCount: 0, followerCount: 0,
    }));
  }
  cache.set(handle, user.id);
  return user.id;
}

// ── Pre-flight env check ────────────────────────────────────────────────────
export function requireEnv(needsBackend: boolean): void {
  if (!API_KEY) throw new Error('PISOMAP_API_KEY required in env');
  if (needsBackend && (!BACKEND || !ADMIN_JWT)) {
    throw new Error('BACKEND_PUBLIC_URL + IMPORT_ADMIN_JWT required for image upload / unlink');
  }
}
