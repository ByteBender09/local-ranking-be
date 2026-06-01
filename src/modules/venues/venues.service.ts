import { Injectable, NotFoundException } from '@nestjs/common';
import { Venue } from '../../database/entities';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { ListVenuesDto } from './dto/list-venues.dto';
import { VenuesRepository } from './venues.repository';

@Injectable()
export class VenuesService {
  constructor(private readonly repo: VenuesRepository) {}

  async list(filter: ListVenuesDto): Promise<PaginatedResponse<Venue>> {
    const [items, total] = await this.repo.findPaged(filter);
    return new PaginatedResponse(items, total, filter.page, filter.limit);
  }

  byIds(ids: string[]): Promise<Venue[]> {
    return this.repo.findByIds(ids);
  }

  categoryCounts(citySlug?: string): Promise<Record<string, number>> {
    return this.repo.categoryCounts(citySlug);
  }

  async getBySlug(slug: string): Promise<Venue> {
    const venue = await this.repo.findBySlug(slug);
    if (!venue) throw new NotFoundException(`Venue not found: ${slug}`);
    return venue;
  }

  trending(limit = 12): Promise<Venue[]> {
    return this.repo.findTrending(limit);
  }

  search(q: string, limit = 8): Promise<Venue[]> {
    if (!q.trim()) return Promise.resolve([]);
    return this.repo.search(q.trim(), limit);
  }
}
