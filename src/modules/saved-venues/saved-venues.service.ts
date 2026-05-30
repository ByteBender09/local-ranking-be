import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedVenue, Venue } from '../../database/entities';
import { nextMonthlyResetAt } from '../../common/utils/time.util';

@Injectable()
export class SavedVenuesService {
  private readonly logger = new Logger(SavedVenuesService.name);

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

  /** When the saved list will next be wiped (1st of next month, VN time). */
  nextResetAt(): Date {
    return nextMonthlyResetAt();
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

  // Wipe every user's saved list on the 1st of each month (Vietnam time).
  // This is intentionally destructive — saved venues are a monthly "shortlist"
  // that starts fresh, and it keeps the community-favorites window honest.
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'saved-venues-monthly-reset',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async monthlyReset(): Promise<void> {
    const result = await this.saved
      .createQueryBuilder()
      .delete()
      .from(SavedVenue)
      .execute();
    this.logger.log(
      `Monthly saved-venues reset: cleared ${result.affected ?? 0} rows`,
    );
  }
}
