import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedVenue, Venue } from '../../database/entities';

@Injectable()
export class SavedVenuesService {
  constructor(
    @InjectRepository(SavedVenue)
    private readonly saved: Repository<SavedVenue>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
  ) {}

  list(userId: string): Promise<SavedVenue[]> {
    return this.saved.find({
      where: { userId },
      relations: { venue: { city: true } },
      order: { addedAt: 'DESC' },
    });
  }

  async add(venueSlug: string, userId: string): Promise<SavedVenue> {
    const venue = await this.venues.findOne({ where: { slug: venueSlug } });
    if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

    const existing = await this.saved.findOne({
      where: { venueId: venue.id, userId },
    });
    if (existing) return existing;

    const created = this.saved.create({ venueId: venue.id, userId });
    return this.saved.save(created);
  }

  async remove(venueSlug: string, userId: string): Promise<void> {
    const venue = await this.venues.findOne({ where: { slug: venueSlug } });
    if (!venue) return;
    await this.saved.delete({ venueId: venue.id, userId });
  }
}
