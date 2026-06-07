import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from '../../database/entities';
import { UploadIngestionService, isOwnUrl } from './upload-ingestion.service';

const CONCURRENCY = 2;

/**
 * In-process background worker that rehosts external venue images to our own
 * CDN. Admin venue create/update returns immediately after persisting the
 * venue with raw external URLs; this queue downloads + re-encodes + swaps
 * them in `images[]` asynchronously so the admin request never waits on
 * slow third-party CDNs.
 *
 * Crash-safe: the source of truth is `venue.image_ingestion_status.pending`
 * in Postgres. A process restart loses the in-memory queue but a small
 * resume() on boot picks up where it left off.
 */
@Injectable()
export class VenueImageRehostQueue implements OnModuleDestroy {
  private readonly logger = new Logger(VenueImageRehostQueue.name);
  private readonly queue: string[] = [];
  private readonly inQueue = new Set<string>();
  private readonly activeVenues = new Set<string>();
  private activeCount = 0;
  private shuttingDown = false;

  constructor(
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    private readonly ingestion: UploadIngestionService,
  ) {}

  onModuleDestroy(): void {
    this.shuttingDown = true;
  }

  /**
   * Schedule background rehost for a venue. Idempotent — re-enqueueing a
   * venue already in flight is a no-op (the active worker reloads the row
   * before each URL, so it'll see any new pending entries).
   */
  enqueue(venueId: string): void {
    if (this.inQueue.has(venueId) || this.activeVenues.has(venueId)) return;
    this.inQueue.add(venueId);
    this.queue.push(venueId);
    this.pump();
  }

  /**
   * Boot-time recovery: scan for venues with non-empty `pending` and
   * re-enqueue them. Call once from app bootstrap.
   */
  async resume(): Promise<void> {
    const rows = await this.venues
      .createQueryBuilder('v')
      .select(['v.id'])
      .where(`v.image_ingestion_status -> 'pending' IS NOT NULL`)
      .andWhere(`jsonb_array_length(v.image_ingestion_status -> 'pending') > 0`)
      .getMany();
    for (const r of rows) this.enqueue(r.id);
    if (rows.length > 0) {
      this.logger.log(`Resumed ${rows.length} venue(s) with pending ingestion`);
    }
  }

  private pump(): void {
    while (
      !this.shuttingDown &&
      this.activeCount < CONCURRENCY &&
      this.queue.length > 0
    ) {
      const venueId = this.queue.shift()!;
      this.inQueue.delete(venueId);
      if (this.activeVenues.has(venueId)) continue;
      this.activeVenues.add(venueId);
      this.activeCount += 1;
      this.processVenue(venueId)
        .catch((e) =>
          this.logger.error(
            `Worker crashed for venue ${venueId}: ${e instanceof Error ? e.message : String(e)}`,
          ),
        )
        .finally(() => {
          this.activeCount -= 1;
          this.activeVenues.delete(venueId);
          this.pump();
        });
    }
  }

  private async processVenue(venueId: string): Promise<void> {
    // Process URLs one at a time, reloading the row between each — admin may
    // remove/replace images mid-flight and we don't want to clobber edits.
    for (;;) {
      if (this.shuttingDown) return;
      const venue = await this.venues.findOne({ where: { id: venueId } });
      if (!venue) return;
      const pending = venue.imageIngestionStatus?.pending ?? [];
      if (pending.length === 0) {
        if (venue.imageIngestionStatus?.failed.length === 0) {
          venue.imageIngestionStatus = null;
          await this.venues.save(venue);
        }
        return;
      }
      const url = pending[0];

      if (isOwnUrl(url)) {
        await this.advance(venueId, url, url, false);
        continue;
      }

      let newUrl: string | null = null;
      try {
        newUrl = await this.ingestion.ingestFromUrl(url);
      } catch (e) {
        this.logger.warn(
          `Failed to rehost ${url} for venue ${venueId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      await this.advance(venueId, url, newUrl, newUrl === null);
    }
  }

  /**
   * Atomic-ish: reload the venue, remove `url` from pending, and either swap
   * `url`→`newUrl` in `images[]` (on success) or push `url` to `failed`.
   * Done in a single save() so the row never observes a half-applied state.
   */
  private async advance(
    venueId: string,
    url: string,
    newUrl: string | null,
    isFailure: boolean,
  ): Promise<void> {
    const venue = await this.venues.findOne({ where: { id: venueId } });
    if (!venue) return;
    const status = venue.imageIngestionStatus ?? { pending: [], failed: [] };
    status.pending = status.pending.filter((u) => u !== url);

    if (isFailure) {
      if (!status.failed.includes(url)) status.failed.push(url);
    } else if (newUrl && newUrl !== url) {
      const idx = venue.images.indexOf(url);
      if (idx >= 0) {
        venue.images = [
          ...venue.images.slice(0, idx),
          newUrl,
          ...venue.images.slice(idx + 1),
        ];
      }
    }

    venue.imageIngestionStatus =
      status.pending.length === 0 && status.failed.length === 0 ? null : status;
    await this.venues.save(venue);
  }
}
