import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JourneyEntry, Venue } from '../../database/entities';

@Injectable()
export class JourneyService {
  constructor(
    @InjectRepository(JourneyEntry) private readonly entries: Repository<JourneyEntry>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
  ) {}

  list(userId: string): Promise<JourneyEntry[]> {
    return this.entries.find({
      where: { userId },
      relations: { venue: { city: true } },
      order: { addedAt: 'DESC' },
    });
  }

  async add(venueSlug: string, userId: string, note?: string): Promise<JourneyEntry> {
    const venue = await this.venues.findOne({ where: { slug: venueSlug } });
    if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

    const existing = await this.entries.findOne({
      where: { venueId: venue.id, userId },
    });
    if (existing) return existing;

    const created = this.entries.create({ venueId: venue.id, userId, note: note ?? null });
    return this.entries.save(created);
  }

  async remove(venueSlug: string, userId: string): Promise<void> {
    const venue = await this.venues.findOne({ where: { slug: venueSlug } });
    if (!venue) return;
    await this.entries.delete({ venueId: venue.id, userId });
  }

  async seed(userId: string, venueIds: string[]): Promise<number> {
    if (venueIds.length === 0) return 0;
    const validVenues = await this.venues.find({
      where: { id: In(venueIds) },
      select: { id: true },
    });
    const existing = await this.entries.find({
      where: { userId, venueId: In(validVenues.map((v) => v.id)) },
      select: { venueId: true },
    });
    const seen = new Set(existing.map((e) => e.venueId));
    const fresh = validVenues.filter((v) => !seen.has(v.id));
    if (fresh.length === 0) return 0;

    await this.entries.insert(
      fresh.map((v) => ({ userId, venueId: v.id })),
    );
    return fresh.length;
  }
}
