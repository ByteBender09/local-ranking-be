import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tour, Category } from '../../database/entities';

@Injectable()
export class ToursService {
  constructor(
    @InjectRepository(Tour) private readonly tours: Repository<Tour>,
  ) {}

  list(
    citySlug?: string,
    category?: Category,
    venueId?: string,
    limit = 20,
  ): Promise<Tour[]> {
    const qb = this.tours
      .createQueryBuilder('t')
      .innerJoin('t.city', 'c')
      .addSelect('c.slug')
      .where('t.is_published = true')
      .orderBy('t.rating', 'DESC')
      .limit(limit);
    if (citySlug) qb.andWhere('c.slug = :citySlug', { citySlug });
    if (category) qb.andWhere('t.category = :category', { category });
    // Tours explicitly attached to a venue (the business picked it when
    // creating the tour). This is the real "related tours" relationship —
    // NOT a category/city heuristic.
    if (venueId) qb.andWhere(':venueId = ANY(t.venue_ids)', { venueId });
    return qb.getMany();
  }

  async bySlug(slug: string): Promise<Tour> {
    const tour = await this.tours.findOne({
      where: { slug },
      relations: { city: true, stops: { city: true, venue: true } },
      // Render the itinerary in visiting order.
      order: { stops: { order: 'ASC' } },
    });
    if (!tour) throw new NotFoundException(`Tour not found: ${slug}`);
    return tour;
  }
}
