import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      .innerJoinAndSelect('venue.city', 'city');

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

  findBySlug(slug: string): Promise<Venue | null> {
    return this.repo
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .where('venue.slug = :slug', { slug })
      .getOne();
  }

  findTrending(limit: number): Promise<Venue[]> {
    return this.repo
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .orderBy('venue.upvotes', 'DESC')
      .limit(limit)
      .getMany();
  }

  search(query: string, limit: number): Promise<Venue[]> {
    const term = `%${query.toLowerCase()}%`;
    return this.repo
      .createQueryBuilder('venue')
      .innerJoinAndSelect('venue.city', 'city')
      .where('LOWER(venue.name) LIKE :term', { term })
      .orWhere('LOWER(venue.district) LIKE :term', { term })
      .orWhere('LOWER(venue.address) LIKE :term', { term })
      .orderBy('venue.upvotes', 'DESC')
      .limit(limit)
      .getMany();
  }
}
