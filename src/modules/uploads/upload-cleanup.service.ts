import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { basename, join, resolve } from 'path';
import { UploadConfig } from '../../config/configuration';

// Filename guard mirrors what UserUploadsController writes: timestamp +
// random hex + a known image extension. Anything else (path traversal
// attempts like "..", absolute paths, etc.) gets rejected before we touch
// the filesystem.
const SAFE_FILENAME = /^[a-zA-Z0-9_.-]+\.(jpe?g|png|webp|gif|avif)$/i;

/**
 * Deletes uploaded image files from the local disk store when the rows that
 * referenced them go away. Used by check-ins.service when a memory is
 * deleted or photos are dropped during an edit, so orphans don't accumulate
 * in the upload volume.
 *
 * Best-effort: anything we can't safely identify as one of OUR uploads is
 * silently skipped (external URLs, scraped photos, etc.), and unlink errors
 * are logged but never thrown — callers should never have their DB tx fail
 * because a stray file cleanup failed.
 */
@Injectable()
export class UploadCleanupService {
  private readonly logger = new Logger(UploadCleanupService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Diff an array field (e.g. `venue.images`, `checkIn.photos`) and
   * unlink files that were present before but aren't in the new list.
   * No-op when neither side actually changed. Safe to call with the same
   * array on both sides — returns 0.
   */
  async diffAndDelete(
    oldUrls: readonly string[] | null | undefined,
    newUrls: readonly string[] | null | undefined,
  ): Promise<number> {
    const next = new Set(newUrls ?? []);
    const dropped: string[] = [];
    for (const url of oldUrls ?? []) {
      if (!next.has(url)) dropped.push(url);
    }
    if (dropped.length === 0) return 0;
    return this.deleteByUrls(dropped);
  }

  /**
   * Single-field image replacement (e.g. `brand.logoUrl`, `tour.image`,
   * `user.avatar`). Unlinks the old URL when it's being replaced or
   * cleared. No-op when the URL hasn't changed or there was no prior URL.
   */
  async replaceAndDelete(
    oldUrl: string | null | undefined,
    newUrl: string | null | undefined,
  ): Promise<number> {
    if (!oldUrl || oldUrl === newUrl) return 0;
    return this.deleteByUrls([oldUrl]);
  }

  /**
   * Delete every URL in `urls` that points to our local upload store.
   * Returns the count of files actually removed (mostly useful in tests).
   */
  async deleteByUrls(urls: Iterable<string>): Promise<number> {
    const cfg = this.config.get<UploadConfig>('upload');
    if (!cfg) return 0;
    const root = resolve(cfg.diskPath);

    let removed = 0;
    for (const url of urls) {
      const filename = this.extractOwnedFilename(url, cfg);
      if (!filename) continue;
      const full = join(root, filename);
      // Defense in depth: even with the SAFE_FILENAME regex, double-check
      // the resolved path lives under root before unlinking.
      if (!full.startsWith(root)) continue;
      try {
        await fs.unlink(full);
        removed += 1;
      } catch (e: unknown) {
        const code = (e as NodeJS.ErrnoException)?.code;
        // ENOENT = file already gone (double delete, manual cleanup).
        // Anything else is worth a warning but never throws.
        if (code !== 'ENOENT') {
          this.logger.warn(
            `Failed to unlink ${full}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }
    return removed;
  }

  /**
   * Returns the safe filename if `url` is one of OUR /uploads/ URLs;
   * otherwise null. Accepts both fully-qualified URLs and relative paths
   * (the FE has stored both shapes over time).
   */
  private extractOwnedFilename(url: string, cfg: UploadConfig): string | null {
    if (!url || typeof url !== 'string') return null;
    // Pull just the pathname so we can compare against /uploads/ regardless
    // of the host (covers publicUrl, request-origin URLs, and bare paths).
    let pathname: string;
    try {
      pathname = url.startsWith('/') ? url : new URL(url).pathname;
    } catch {
      return null;
    }
    // Only files served by our static `/uploads/` route are ours to delete.
    const PREFIX = '/uploads/';
    if (!pathname.startsWith(PREFIX)) return null;
    const filename = basename(pathname);
    if (!SAFE_FILENAME.test(filename)) return null;
    // Cheap belt-and-suspenders: if publicUrl is set, prefer that as the
    // expected host but don't *require* it — local-dev URLs use the
    // request's own host (see UserUploadsController).
    if (cfg.publicUrl) {
      // No-op — we already trust the prefix + filename guard.
    }
    return filename;
  }
}
