import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Venue } from '../../database/entities';
import { ListVenuesDto, VenueSort } from './dto/list-venues.dto';

@Injectable()
export class VenuesRepository {
  constructor(
    @InjectRepository(Venue) private readonly repo: Repository<Venue>,
  ) {}

  private orderBy(sort: VenueSort): {
    field: string;
    direction: 'ASC' | 'DESC';
  } {
    switch (sort) {
      case 'rating':
        return { field: 'venue.rating', direction: 'DESC' };
      case 'newest':
        return { field: 'venue.createdAt', direction: 'DESC' };
      case 'upvotes':
      default:
        return { field: 'venue.upvotes', direction: 'DESC' };
    }
  }

  findPaged(filter: ListVenuesDto): Promise<[Venue[], number]> {
    const qb = this.repo
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .where('venue.is_published = true');

    if (filter.citySlug)
      qb.andWhere('city.slug = :citySlug', { citySlug: filter.citySlug });
    if (filter.category)
      qb.andWhere('venue.category = :category', { category: filter.category });
    if (filter.district)
      qb.andWhere('venue.district = :district', { district: filter.district });

    const order = this.orderBy(filter.sort);
    qb.orderBy(order.field, order.direction)
      .addOrderBy('venue.id', 'ASC')
      .skip(filter.skip)
      .take(filter.limit);

    return qb.getManyAndCount();
  }

  // Resolve a set of venues by id (preserves nothing about order — the caller
  // re-orders). Includes the city relation so chips can show district/category.
  // NOT filtered by is_published: a tour may legitimately reference a venue
  // that's currently unpublished, and the editor still needs to show its chip.
  findByIds(ids: string[]): Promise<Venue[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repo.find({
      where: { id: In(ids) },
      relations: { city: true },
    });
  }

  findBySlug(slug: string): Promise<Venue | null> {
    // Public detail view also hides unpublished venues from anonymous users.
    return this.repo
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .where('venue.slug = :slug', { slug })
      .andWhere('venue.is_published = true')
      .getOne();
  }

  findTrending(limit: number): Promise<Venue[]> {
    return this.repo
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .where('venue.is_published = true')
      .orderBy('venue.upvotes', 'DESC')
      .limit(limit)
      .getMany();
  }

  search(query: string, limit: number): Promise<Venue[]> {
    const term = `%${query.toLowerCase()}%`;
    return this.repo
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .where('venue.is_published = true')
      .andWhere(
        '(LOWER(venue.name) LIKE :term OR LOWER(venue.district) LIKE :term OR LOWER(venue.address) LIKE :term)',
        { term },
      )
      .orderBy('venue.upvotes', 'DESC')
      .limit(limit)
      .getMany();
  }
}
