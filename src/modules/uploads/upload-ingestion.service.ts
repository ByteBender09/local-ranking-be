import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, promises as fs } from 'fs';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { UploadConfig } from '../../config/configuration';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 16 * 1024 * 1024;

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

export function isOwnUrl(url: string): boolean {
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

  constructor(private readonly config: ConfigService) {}

  /**
   * Download → re-encode to WebP → write to local upload disk → return the
   * canonical public URL. No self-HTTP — bypasses throttler, JWT guard, and
   * the cost of a second inbound TLS/connection slot per image.
   */
  async ingestFromUrl(url: string): Promise<string> {
    const cfg = this.config.get<UploadConfig>('upload');
    if (!cfg) throw new Error('upload config missing');
    if (!cfg.publicUrl) {
      throw new Error('UPLOAD_PUBLIC_URL not configured');
    }

    const downloaded = await this.downloadWithRetry(url);
    const webp = await sharp(Buffer.from(downloaded))
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const filename = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.webp`;
    const dir = resolve(cfg.diskPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await fs.writeFile(join(dir, filename), webp);

    return `${cfg.publicUrl.replace(/\/$/, '')}/uploads/${filename}`;
  }

  private async downloadWithRetry(url: string): Promise<ArrayBuffer> {
    try {
      return await this.download(url);
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
      return this.download(url);
    }
  }

  private async download(url: string): Promise<ArrayBuffer> {
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
