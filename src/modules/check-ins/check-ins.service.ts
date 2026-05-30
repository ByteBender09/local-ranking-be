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
import { CreateCheckInDto, UpdateMemoryDto } from './dto/check-in.dto';
import { isSameVnDay } from '../../common/utils/time.util';

// A memory can be edited/deleted only within this window of its creation.
const MEMORY_LOCK_MS = 30 * 60 * 1000;

@Injectable()
export class CheckInsService {
  constructor(private readonly dataSource: DataSource) {}

  listByUser(userId: string): Promise<CheckIn[]> {
    return this.dataSource.getRepository(CheckIn).find({
      where: { userId },
      relations: { venue: { city: true } },
      order: { createdAt: 'DESC' },
    });
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
      const venue = await manager.findOne(Venue, { where: { slug: venueSlug } });
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

  // Create or update the memory on a specific check-in. The first write stamps
  // memoryCreatedAt; subsequent writes are allowed only within MEMORY_LOCK_MS.
  async updateMemory(
    checkInId: string,
    userId: string,
    patch: UpdateMemoryDto,
  ): Promise<CheckIn> {
    return this.dataSource.transaction(async (manager) => {
      const ci = await manager.findOne(CheckIn, { where: { id: checkInId } });
      if (!ci) throw new NotFoundException('Check-in not found');
      if (ci.userId !== userId) {
        throw new ForbiddenException('Not your check-in');
      }

      const now = new Date();
      if (ci.memoryCreatedAt) {
        if (now.getTime() - ci.memoryCreatedAt.getTime() > MEMORY_LOCK_MS) {
          throw new ForbiddenException(
            'Kỉ niệm đã được khóa sau 30 phút và không thể chỉnh sửa.',
          );
        }
      } else {
        ci.memoryCreatedAt = now;
      }

      if (patch.comment !== undefined) ci.comment = patch.comment;
      if (patch.photos !== undefined) ci.photos = patch.photos;
      if (patch.friends !== undefined) ci.friends = patch.friends;
      if (patch.isPublic !== undefined) ci.isPublic = patch.isPublic;

      return manager.save(ci);
    });
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

  // Delete a specific check-in. Rule:
  //  - No memory yet → deletable any time.
  //  - Memory created < 30 min ago → still deletable.
  //  - Memory created ≥ 30 min ago → LOCKED (cannot delete the check-in).
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

      await manager.delete(CheckIn, { id: ci.id });
      await manager.decrement(User, { id: userId }, 'checkInCount', 1);

      // Upvotes require at least one check-in. If this was the user's last
      // check-in at the venue, drop any lingering vote + denormalised counter.
      const remaining = await manager.count(CheckIn, {
        where: { venueId: ci.venueId, userId },
      });
      if (remaining === 0) {
        const vote = await manager.findOne(Vote, {
          where: { venueId: ci.venueId, userId },
        });
        if (vote) {
          if (vote.value === 1) {
            await manager.decrement(Venue, { id: ci.venueId }, 'upvotes', 1);
          }
          await manager.delete(Vote, { id: vote.id });
        }
      }
    });
  }
}
