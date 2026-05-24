import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CheckIn, User, Venue, Vote } from '../../database/entities';
import { CreateCheckInDto, UpdateMemoryDto } from './dto/check-in.dto';

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

  async create(
    venueSlug: string,
    userId: string,
    dto: CreateCheckInDto,
  ): Promise<CheckIn> {
    return this.dataSource.transaction(async (manager) => {
      const venue = await manager.findOne(Venue, { where: { slug: venueSlug } });
      if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

      const existing = await manager.findOne(CheckIn, {
        where: { venueId: venue.id, userId },
      });
      if (existing) return existing;

      const created = manager.create(CheckIn, {
        venueId: venue.id,
        userId,
        comment: dto.comment ?? null,
        photos: [],
        friends: [],
        isPublic: true,
      });
      await manager.save(created);
      await manager.increment(User, { id: userId }, 'checkInCount', 1);
      return created;
    });
  }

  async updateMemory(
    venueSlug: string,
    userId: string,
    patch: UpdateMemoryDto,
  ): Promise<CheckIn> {
    return this.dataSource.transaction(async (manager) => {
      const venue = await manager.findOne(Venue, { where: { slug: venueSlug } });
      if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

      const ci = await manager.findOne(CheckIn, {
        where: { venueId: venue.id, userId },
      });
      if (!ci) throw new NotFoundException('Check-in not found');

      if (patch.comment !== undefined) ci.comment = patch.comment;
      if (patch.photos !== undefined) ci.photos = patch.photos;
      if (patch.friends !== undefined) ci.friends = patch.friends;
      if (patch.isPublic !== undefined) ci.isPublic = patch.isPublic;

      return manager.save(ci);
    });
  }

  async remove(venueSlug: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const venue = await manager.findOne(Venue, { where: { slug: venueSlug } });
      if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

      // If the user had an upvote on this venue, drop the denormalised counter
      // before deleting the vote — votes require a check-in.
      const existingVote = await manager.findOne(Vote, {
        where: { venueId: venue.id, userId },
      });
      if (existingVote?.value === 1) {
        await manager.decrement(Venue, { id: venue.id }, 'upvotes', 1);
      }
      if (existingVote) {
        await manager.delete(Vote, { id: existingVote.id });
      }

      const result = await manager.delete(CheckIn, {
        venueId: venue.id,
        userId,
      });
      if (result.affected) {
        await manager.decrement(User, { id: userId }, 'checkInCount', 1);
      }
    });
  }
}
