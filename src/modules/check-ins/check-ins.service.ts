import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CheckIn,
  JourneyEntry,
  User,
  Venue,
  Vote,
} from '../../database/entities';
import {
  CreateCheckInDto,
  CreateCustomCheckInDto,
  UpdateMemoryDto,
} from './dto/check-in.dto';
import { isSameVnDay } from '../../common/utils/time.util';
import { UploadCleanupService } from '../uploads/upload-cleanup.service';

// A memory can be edited/deleted only within this window of its creation.
const MEMORY_LOCK_MS = 30 * 60 * 1000;

@Injectable()
export class CheckInsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly uploads: UploadCleanupService,
  ) {}

  listByUser(userId: string): Promise<CheckIn[]> {
    return this.dataSource.getRepository(CheckIn).find({
      where: { userId },
      relations: { venue: { city: true } },
      order: { createdAt: 'DESC' },
    });
  }

  // Public-only check-ins surfaced on someone else's profile. Returns the
  // same shape as listByUser but filtered to is_public = true so private
  // memories never leak. Capped at `limit` (default 24) so the profile
  // page stays bounded.
  listPublicByUser(userId: string, limit = 24): Promise<CheckIn[]> {
    return this.dataSource.getRepository(CheckIn).find({
      where: { userId, isPublic: true },
      relations: { venue: { city: true } },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  // Single check-in for the public memory page (/m/[id] on the web). Loads
  // the full venue (+ city) and the author so the page can render without
  // additional round-trips. Returns null on:
  //   - id not found
  //   - check-in is private AND the viewer is not the owner
  // The controller treats null as a 404 (we deliberately don't 403 — that
  // would leak that the id exists; a stranger sees the same response as for
  // a non-existent id).
  async findByIdForViewer(
    id: string,
    viewerId?: string,
  ): Promise<CheckIn | null> {
    const ci = await this.dataSource.getRepository(CheckIn).findOne({
      where: { id },
      relations: { venue: { city: true }, user: true },
    });
    if (!ci) return null;
    if (!ci.isPublic && ci.userId !== viewerId) return null;
    return ci;
  }

  // Create a NEW check-in. A venue may be checked in many times, but at most
  // once per Vietnam calendar day — the user must wait until the next day to
  // check in to the same venue again. A memory (comment/photos) may be supplied
  // now or added later via updateMemory().
  async create(
    venueSlug: string,
    userId: string,
    dto: CreateCheckInDto,
  ): Promise<CheckIn> {
    return this.dataSource.transaction(async (manager) => {
      const venue = await manager.findOne(Venue, {
        where: { slug: venueSlug },
      });
      if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

      const last = await manager.findOne(CheckIn, {
        where: { venueId: venue.id, userId },
        order: { createdAt: 'DESC' },
      });
      if (last && isSameVnDay(last.createdAt, new Date())) {
        throw new ConflictException(
          'Bạn đã check-in địa điểm này hôm nay rồi. Hẹn gặp lại vào ngày mai nhé!',
        );
      }

      const hasMemory =
        Boolean(dto.comment && dto.comment.trim()) ||
        Boolean(dto.photos && dto.photos.length);

      const created = manager.create(CheckIn, {
        venueId: venue.id,
        userId,
        comment: dto.comment ?? null,
        photos: dto.photos ?? [],
        friends: dto.friends ?? [],
        isPublic: dto.isPublic ?? true,
        memoryCreatedAt: hasMemory ? new Date() : null,
      });
      await manager.save(created);
      await manager.increment(User, { id: userId }, 'checkInCount', 1);

      // Auto-add to the user's journey so the venue shows up in the timeline
      // immediately after a check-in. Skip if already present — re-checking in
      // shouldn't bump the journey order.
      const existingJourney = await manager.findOne(JourneyEntry, {
        where: { venueId: venue.id, userId },
      });
      if (!existingJourney) {
        await manager.save(
          manager.create(JourneyEntry, {
            venueId: venue.id,
            userId,
            note: null,
          }),
        );
      }
      return created;
    });
  }

  // Create a check-in at a custom place NOT in the venues catalog. venueId is
  // left null; the row stores its own placeName + lat/lng. No per-day
  // uniqueness applies (there's no venue to dedupe against) and we don't touch
  // the journey timeline (which is venue-based). Used by the trip feature so
  // members can capture memories anywhere along the way.
  async createCustom(
    userId: string,
    dto: CreateCustomCheckInDto,
  ): Promise<CheckIn> {
    return this.dataSource.transaction(async (manager) => {
      const hasMemory =
        Boolean(dto.comment && dto.comment.trim()) ||
        Boolean(dto.photos && dto.photos.length);

      const created = manager.create(CheckIn, {
        venueId: null,
        userId,
        placeName: dto.placeName,
        placeAddress: dto.placeAddress ?? null,
        lat: dto.lat,
        lng: dto.lng,
        comment: dto.comment ?? null,
        photos: dto.photos ?? [],
        friends: dto.friends ?? [],
        isPublic: dto.isPublic ?? true,
        memoryCreatedAt: hasMemory ? new Date() : null,
      });
      await manager.save(created);
      await manager.increment(User, { id: userId }, 'checkInCount', 1);
      return created;
    });
  }

  // Create or update the memory on a specific check-in. The first write stamps
  // memoryCreatedAt; subsequent writes are allowed only within MEMORY_LOCK_MS.
  async updateMemory(
    checkInId: string,
    userId: string,
    patch: UpdateMemoryDto,
  ): Promise<CheckIn> {
    // Capture the set of photos that get dropped during the update so we
    // can unlink them from disk AFTER the transaction commits — never
    // before. If the tx rolls back for any reason, the file still exists
    // and the row still points at it, so nothing dangles.
    const droppedPhotos: string[] = [];
    const saved = await this.dataSource.transaction(async (manager) => {
      const ci = await manager.findOne(CheckIn, { where: { id: checkInId } });
      if (!ci) throw new NotFoundException('Check-in not found');
      if (ci.userId !== userId) {
        throw new ForbiddenException('Not your check-in');
      }

      const now = new Date();

      // Privacy toggle is intentionally exempt from the 30-minute lock —
      // users should always be able to retract a public memory regardless
      // of how old it is. We detect "privacy-only" by checking that no
      // content-bearing field is being patched.
      const isPrivacyOnly =
        patch.isPublic !== undefined &&
        patch.comment === undefined &&
        patch.photos === undefined &&
        patch.friends === undefined;

      if (ci.memoryCreatedAt) {
        if (
          !isPrivacyOnly &&
          now.getTime() - ci.memoryCreatedAt.getTime() > MEMORY_LOCK_MS
        ) {
          throw new ForbiddenException(
            'Kỉ niệm đã được khóa sau 30 phút và không thể chỉnh sửa.',
          );
        }
      } else if (!isPrivacyOnly) {
        // First content write stamps the lock timer. A privacy-only toggle
        // on a row with no memory yet shouldn't start the clock.
        ci.memoryCreatedAt = now;
      }

      if (patch.comment !== undefined) ci.comment = patch.comment;
      if (patch.photos !== undefined) {
        const next = new Set(patch.photos);
        for (const url of ci.photos ?? []) {
          if (!next.has(url)) droppedPhotos.push(url);
        }
        ci.photos = patch.photos;
      }
      if (patch.friends !== undefined) ci.friends = patch.friends;
      if (patch.isPublic !== undefined) ci.isPublic = patch.isPublic;

      return manager.save(ci);
    });

    if (droppedPhotos.length > 0) {
      await this.uploads.deleteByUrls(droppedPhotos);
    }
    return saved;
  }

  // Convenience wrappers that target the user's MOST RECENT check-in at a venue
  // by slug. The web client uses a one-memory-per-venue model, so "edit my
  // memory here" maps to the latest check-in. The 30-minute lock still applies.
  async updateLatestMemory(
    venueSlug: string,
    userId: string,
    patch: UpdateMemoryDto,
  ): Promise<CheckIn> {
    const latest = await this.findLatest(venueSlug, userId);
    return this.updateMemory(latest.id, userId, patch);
  }

  async removeLatest(venueSlug: string, userId: string): Promise<void> {
    const venue = await this.dataSource
      .getRepository(Venue)
      .findOne({ where: { slug: venueSlug } });
    if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);
    const latest = await this.dataSource.getRepository(CheckIn).findOne({
      where: { venueId: venue.id, userId },
      order: { createdAt: 'DESC' },
    });
    if (!latest) return; // idempotent
    await this.remove(latest.id, userId);
  }

  private async findLatest(
    venueSlug: string,
    userId: string,
  ): Promise<CheckIn> {
    const venue = await this.dataSource
      .getRepository(Venue)
      .findOne({ where: { slug: venueSlug } });
    if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);
    const latest = await this.dataSource.getRepository(CheckIn).findOne({
      where: { venueId: venue.id, userId },
      order: { createdAt: 'DESC' },
    });
    if (!latest) throw new NotFoundException('Check-in not found');
    return latest;
  }

  // Soft-delete a specific check-in. Rule:
  //  - No memory yet → deletable any time.
  //  - Memory created < 30 min ago → still deletable.
  //  - Memory created ≥ 30 min ago → LOCKED (cannot delete the check-in).
  //
  // Photo files are intentionally NOT unlinked here — the row stays in the
  // DB (with deleted_at set) and can be restored later. Only photos that
  // were explicitly removed via updateMemory() get unlinked from disk.
  async remove(checkInId: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const ci = await manager.findOne(CheckIn, { where: { id: checkInId } });
      if (!ci) return; // idempotent
      if (ci.userId !== userId) {
        throw new ForbiddenException('Not your check-in');
      }
      if (
        ci.memoryCreatedAt &&
        Date.now() - ci.memoryCreatedAt.getTime() > MEMORY_LOCK_MS
      ) {
        throw new ForbiddenException(
          'Kỉ niệm đã được khóa sau 30 phút — không thể xóa lượt check-in này.',
        );
      }

      await manager.softDelete(CheckIn, { id: ci.id });
      await manager.decrement(User, { id: userId }, 'checkInCount', 1);

      // Vote cleanup only applies to venue-based check-ins — custom places
      // (venueId null) carry no votes.
      const venueId = ci.venueId;
      if (venueId) {
        // Upvotes require at least one check-in. If this was the user's last
        // check-in at the venue, drop any lingering vote + denormalised
        // counter. Votes themselves don't carry images, so we hard-delete
        // them as before — no recovery concern.
        const remaining = await manager.count(CheckIn, {
          where: { venueId, userId },
        });
        if (remaining === 0) {
          const vote = await manager.findOne(Vote, {
            where: { venueId, userId },
          });
          if (vote) {
            if (vote.value === 1) {
              await manager.decrement(Venue, { id: venueId }, 'upvotes', 1);
            }
            await manager.delete(Vote, { id: vote.id });
          }
        }
      }
    });
  }
}
