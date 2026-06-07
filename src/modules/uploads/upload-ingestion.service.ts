import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import sharp from 'sharp';

const FETCH_TIMEOUT_MS = 30_000;
const MAX_BYTES = 16 * 1024 * 1024;

// Vietnamese-CDN scrapers (mia.vn, vietnamtourism.gov.vn, etc.) tend to
// 403/429 the default axios UA. Spoof a recent Chrome so downloads succeed.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DOWNLOAD_HEADERS = {
  'User-Agent': BROWSER_UA,
  Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
};

const OWN_HOSTS = new Set(['localhost', '127.0.0.1']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isOwnUrl(url: string): boolean {
  if (!url) return false;
  let host = '';
  let pathname = '';
  try {
    const u = new URL(url, 'http://_');
    host = u.hostname;
    pathname = u.pathname;
  } catch {
    return false;
  }
  if (host === '_') return pathname.startsWith('/uploads/');
  if (OWN_HOSTS.has(host) || host.endsWith('homnaydidau.xyz')) {
    return pathname.startsWith('/uploads/');
  }
  return false;
}

@Injectable()
export class UploadIngestionService {
  private readonly logger = new Logger(UploadIngestionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Downloads `url`, re-encodes to WebP, and uploads via the BE's own
   * `/admin/uploads` HTTP endpoint. Going through HTTP guarantees the
   * stored file and the returned URL always live on the same host —
   * direct disk writes risked a mismatch when a dev BE was used against
   * the prod DB (file landed locally, URL pointed at prod CDN → 404).
   */
  async ingestFromUrl(url: string): Promise<string> {
    const backend = (process.env.BACKEND_PUBLIC_URL ?? '').replace(/\/$/, '');
    if (!backend) {
      throw new Error('BACKEND_PUBLIC_URL not configured');
    }

    const downloaded = await this.downloadWithRetry(url);

    const webp = await sharp(Buffer.from(downloaded))
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const token = this.jwt.sign(
      { sub: 'internal-ingest', handle: 'internal-ingest', role: 'admin' },
      { expiresIn: '1m' },
    );

    const fd = new FormData();
    fd.append(
      'file',
      new Blob([new Uint8Array(webp)], { type: 'image/webp' }),
      'ingested.webp',
    );
    const res = await axios.post<{ data?: { url?: string }; url?: string }>(
      `${backend}/admin/uploads`,
      fd,
      {
        headers: { Authorization: `Bearer ${token}` },
        maxBodyLength: Infinity,
        timeout: FETCH_TIMEOUT_MS,
      },
    );
    const out = res.data?.data?.url ?? res.data?.url;
    if (!out) throw new Error('upload returned no url');
    return out;
  }

  // Single retry with Retry-After respect — covers transient 429/503 from
  // public CDNs without burning the whole save on a hiccup.
  private async downloadWithRetry(url: string): Promise<ArrayBuffer> {
    try {
      const res = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
        headers: DOWNLOAD_HEADERS,
        validateStatus: (s) => s >= 200 && s < 300,
      });
      return res.data;
    } catch (e) {
      if (!axios.isAxiosError(e)) throw e;
      const status = e.response?.status;
      if (status !== 429 && status !== 503) throw e;
      const retryAfter = Number(e.response?.headers?.['retry-after']);
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5000)
          : 1500;
      await sleep(waitMs);
      const res = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: MAX_BYTES,
        maxBodyLength: MAX_BYTES,
        headers: DOWNLOAD_HEADERS,
        validateStatus: (s) => s >= 200 && s < 300,
      });
      return res.data;
    }
  }

  /**
   * Walks `urls`, leaves own-domain URLs untouched, and re-hosts external
   * ones via `ingestFromUrl`. Per-URL failures are swallowed: the failing
   * URL is dropped from the result and the issue logged. Returns the
   * sanitised list — owners can swap any missing asset later via the UI.
   */
  async sanitiseImages(urls: string[]): Promise<{
    images: string[];
    rehosted: number;
    skipped: number;
  }> {
    const out: string[] = [];
    let rehosted = 0;
    let skipped = 0;
    for (const raw of urls ?? []) {
      const url = (raw ?? '').trim();
      if (!url) continue;
      if (isOwnUrl(url)) {
        out.push(url);
        continue;
      }
      try {
        const hosted = await this.ingestFromUrl(url);
        out.push(hosted);
        rehosted += 1;
      } catch (e) {
        skipped += 1;
        this.logger.warn(
          `Skipped external image ${url}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return { images: out, rehosted, skipped };
  }
}
