import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tour, Category } from '../../database/entities';

@Injectable()
export class ToursService {
  constructor(@InjectRepository(Tour) private readonly tours: Repository<Tour>) {}

  list(citySlug?: string, category?: Category, limit = 20): Promise<Tour[]> {
    const qb = this.tours
      .createQueryBuilder('t')
      .innerJoin('t.city', 'c')
      .addSelect('c.slug')
      .where('t.is_published = true')
      .orderBy('t.rating', 'DESC')
      .limit(limit);
    if (citySlug) qb.andWhere('c.slug = :citySlug', { citySlug });
    if (category) qb.andWhere('t.category = :category', { category });
    return qb.getMany();
  }

  async forVenue(citySlug: string, category: Category, limit = 4): Promise<Tour[]> {
    const exact = await this.list(citySlug, category, limit);
    if (exact.length >= limit) return exact;
    const others = await this.tours
      .createQueryBuilder('t')
      .innerJoin('t.city', 'c')
      .where('c.slug = :citySlug', { citySlug })
      .andWhere('t.category <> :category', { category })
      .orderBy('t.rating', 'DESC')
      .limit(limit - exact.length)
      .getMany();
    return [...exact, ...others];
  }

  async bySlug(slug: string): Promise<Tour> {
    const tour = await this.tours.findOne({
      where: { slug },
      relations: { city: true },
    });
    if (!tour) throw new NotFoundException(`Tour not found: ${slug}`);
    return tour;
  }
}
