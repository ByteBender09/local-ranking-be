import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Venue, Vote } from '../../database/entities';

export interface VoteResult {
  value: 1 | -1 | 0;
  upvotes: number;
}

@Injectable()
export class VotesService {
  constructor(private readonly dataSource: DataSource) {}

  async cast(
    venueSlug: string,
    userId: string,
    value: 1 | -1,
  ): Promise<VoteResult> {
    return this.dataSource.transaction(async (manager) => {
      const venue = await manager.findOne(Venue, { where: { slug: venueSlug } });
      if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

      const existing = await manager.findOne(Vote, {
        where: { venueId: venue.id, userId },
      });

      let delta = 0;
      let finalValue: 1 | -1 | 0 = value;

      if (!existing) {
        await manager.insert(Vote, { venueId: venue.id, userId, value });
        delta = value;
      } else if (existing.value === value) {
        await manager.delete(Vote, { id: existing.id });
        delta = -existing.value;
        finalValue = 0;
      } else {
        existing.value = value;
        await manager.save(existing);
        delta = value === 1 ? 2 : -2;
      }

      if (delta !== 0) {
        await manager.increment(Venue, { id: venue.id }, 'upvotes', delta);
      }

      const updated = await manager.findOneOrFail(Venue, {
        where: { id: venue.id },
        select: { id: true, upvotes: true },
      });

      return { value: finalValue, upvotes: updated.upvotes };
    });
  }

  async listUserVotes(userId: string): Promise<{ venueId: string; value: 1 | -1 }[]> {
    const rows = await this.dataSource
      .getRepository(Vote)
      .createQueryBuilder('v')
      .select(['v.venueId AS "venueId"', 'v.value AS value'])
      .where('v.user_id = :uid', { uid: userId })
      .getRawMany<{ venueId: string; value: 1 | -1 }>();
    return rows;
  }
}
