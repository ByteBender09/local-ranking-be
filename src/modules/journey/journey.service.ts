import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CheckIn, JourneyEntry, Venue } from '../../database/entities';

@Injectable()
export class JourneyService {
  private readonly healed = new Set<string>();

  constructor(
    @InjectRepository(JourneyEntry)
    private readonly entries: Repository<JourneyEntry>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(CheckIn) private readonly checkIns: Repository<CheckIn>,
  ) {}

  async list(userId: string): Promise<JourneyEntry[]> {
    if (!this.healed.has(userId)) {
      this.healed.add(userId);
      await this.backfillFromCheckIns(userId);
    }
    return this.entries.find({
      where: { userId },
      relations: { venue: { city: true } },
      order: { addedAt: 'DESC' },
    });
  }

  private async backfillFromCheckIns(userId: string): Promise<void> {
    const userCheckIns = await this.checkIns.find({
      where: { userId },
      select: { venueId: true },
    });
    if (userCheckIns.length === 0) return;
    // Custom (off-catalog) check-ins have no venue and never enter the
    // venue-based journey timeline.
    const checkInVenueIds = userCheckIns
      .map((c) => c.venueId)
      .filter((id): id is string => id !== null);
    if (checkInVenueIds.length === 0) return;
    const existingEntries = await this.entries.find({
      where: { userId, venueId: In(checkInVenueIds) },
      select: { venueId: true },
    });
    const have = new Set(existingEntries.map((e) => e.venueId));
    const missing = checkInVenueIds.filter((id) => !have.has(id));
    if (missing.length === 0) return;
    await this.entries.insert(
      missing.map((venueId) => ({ userId, venueId, note: null })),
    );
  }

  async add(
    venueSlug: string,
    userId: string,
    note?: string,
  ): Promise<JourneyEntry> {
    const venue = await this.venues.findOne({ where: { slug: venueSlug } });
    if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

    const existing = await this.entries.findOne({
      where: { venueId: venue.id, userId },
    });
    if (existing) return existing;

    const created = this.entries.create({
      venueId: venue.id,
      userId,
      note: note ?? null,
    });
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

    await this.entries.insert(fresh.map((v) => ({ userId, venueId: v.id })));
    return fresh.length;
  }
}
