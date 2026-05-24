import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CheckIn, Venue, Vote } from '../../database/entities';

export interface VoteResult {
  value: 1 | -1 | 0;
  upvotes: number;
}

@Injectable()
export class VotesService {
  constructor(private readonly dataSource: DataSource) {}

  // Voting rules:
  // - User must have already checked in to vote.
  // - venue.upvotes is the denormalised count of users that voted +1.
  //   Downvotes are stored for analytics but never shown in listings.
  async cast(
    venueSlug: string,
    userId: string,
    value: 1 | -1,
  ): Promise<VoteResult> {
    return this.dataSource.transaction(async (manager) => {
      const venue = await manager.findOne(Venue, {
        where: { slug: venueSlug },
      });
      if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

      const hasCheckIn = await manager.exists(CheckIn, {
        where: { venueId: venue.id, userId },
      });
      if (!hasCheckIn) {
        throw new ForbiddenException('Check-in required before voting');
      }

      const existing = await manager.findOne(Vote, {
        where: { venueId: venue.id, userId },
      });

      let upvoteDelta = 0;
      let finalValue: 1 | -1 | 0 = value;

      if (!existing) {
        await manager.insert(Vote, { venueId: venue.id, userId, value });
        if (value === 1) upvoteDelta = 1;
      } else if (existing.value === value) {
        // Toggle off
        await manager.delete(Vote, { id: existing.id });
        if (existing.value === 1) upvoteDelta = -1;
        finalValue = 0;
      } else {
        // Flip direction
        existing.value = value;
        await manager.save(existing);
        // Going from -1 → 1 means +1 to upvotes; 1 → -1 means -1.
        upvoteDelta = value === 1 ? 1 : -1;
      }

      if (upvoteDelta !== 0) {
        await manager.increment(Venue, { id: venue.id }, 'upvotes', upvoteDelta);
      }

      const updated = await manager.findOneOrFail(Venue, {
        where: { id: venue.id },
        select: { id: true, upvotes: true },
      });

      return { value: finalValue, upvotes: updated.upvotes };
    });
  }

  listUserVotes(
    userId: string,
  ): Promise<{ venueId: string; value: 1 | -1 }[]> {
    return this.dataSource
      .getRepository(Vote)
      .createQueryBuilder('v')
      .select(['v.venueId AS "venueId"', 'v.value AS value'])
      .where('v.user_id = :uid', { uid: userId })
      .getRawMany<{ venueId: string; value: 1 | -1 }>();
  }
}
