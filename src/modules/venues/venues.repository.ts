import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Venue } from '../../database/entities';
import { ListVenuesDto, VenueSort } from './dto/list-venues.dto';
import { bayesianScoreExpr } from './ranking';

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
        // "Best rated" = Bayesian weighted rating, NOT raw average, so a 4.9★
        // venue with a handful of reviews can't leapfrog a heavily-reviewed
        // 4.6★ one. See ./ranking.ts.
        return { field: bayesianScoreExpr('venue'), direction: 'DESC' };
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
    if (filter.q && filter.q.trim()) {
      // Case-insensitive search across name/district/address + the tags
      // text[] array. Mirrors the client-side filter the FE previously did
      // (now removed so search covers the whole city, not just the loaded
      // page). EXISTS+unnest is the standard way to LIKE-match an element
      // of a Postgres text[].
      const term = `%${filter.q.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(venue.name) LIKE :term
          OR LOWER(venue.district) LIKE :term
          OR LOWER(venue.address) LIKE :term
          OR EXISTS (SELECT 1 FROM unnest(venue.tags) AS tag WHERE LOWER(tag) LIKE :term))`,
        { term },
      );
    }

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

  // Total published-venue count per category for a city (or globally), so the
  // category chips show real totals instead of only what's been rendered.
  async categoryCounts(citySlug?: string): Promise<Record<string, number>> {
    const qb = this.repo
      .createQueryBuilder('venue')
      .select('venue.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('venue.city', 'city')
      .where('venue.is_published = true')
      .groupBy('venue.category');
    if (citySlug) qb.andWhere('city.slug = :citySlug', { citySlug });
    const rows = await qb.getRawMany<{ category: string; count: string }>();
    const out: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const n = parseInt(r.count, 10);
      out[r.category] = n;
      total += n;
    }
    out.all = total;
    return out;
  }

  // Lightweight projection of every published venue for the sitemap: just the
  // slug + last-updated timestamp, no heavy columns (externalRaw etc.). One
  // query, ordered newest-first so the freshest URLs lead.
  sitemapEntries(): Promise<Array<{ slug: string; updatedAt: Date }>> {
    return this.repo
      .createQueryBuilder('venue')
      .select(['venue.slug AS slug', 'venue.updated_at AS "updatedAt"'])
      .where('venue.is_published = true')
      .orderBy('venue.updated_at', 'DESC')
      .getRawMany<{ slug: string; updatedAt: Date }>();
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
