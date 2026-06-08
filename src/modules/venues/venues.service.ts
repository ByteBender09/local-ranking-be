import { Injectable, NotFoundException } from '@nestjs/common';
import { Venue } from '../../database/entities';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { ListVenuesDto } from './dto/list-venues.dto';
import { VenuesRepository } from './venues.repository';
import { WardNormalizerService } from './ward-normalizer.service';

@Injectable()
export class VenuesService {
  constructor(
    private readonly repo: VenuesRepository,
    private readonly wards: WardNormalizerService,
  ) {}

  async list(filter: ListVenuesDto): Promise<PaginatedResponse<Venue>> {
    // Expand a user-facing ward query (raw name OR old district alias)
    // into the canonical wards that actually cover that area, then pass
    // the list to the repo for an IN-filter. Without this, a query like
    // ward=Quận+3 would match zero rows (no venue's ward_canonical IS
    // "Quận 3" — that's an old district name that no longer exists).
    let canonicalWards: string[] = [];
    if (filter.ward && filter.citySlug) {
      canonicalWards = this.wards.expandQueryToWards(filter.citySlug, filter.ward);
      // If the user typed a ward query but nothing resolved, return an
      // empty page rather than ignoring the filter and showing the full
      // city — silently dropping filters is the easiest way to make
      // search results feel broken.
      if (canonicalWards.length === 0) {
        return new PaginatedResponse([], 0, filter.page, filter.limit);
      }
    }
    const [items, total] = await this.repo.findPaged(filter, canonicalWards);
    return new PaginatedResponse(items, total, filter.page, filter.limit);
  }

  // Lists all canonical wards in a city for UI dropdowns / chip lists.
  // Sorted alphabetically; FE can group by type if it wants.
  wardsForCity(citySlug: string): Promise<
    Array<{ name: string; type: string; aliasesOldDistrict: string[] }>
  > {
    return this.repo.wardsForCity(citySlug);
  }

  byIds(ids: string[]): Promise<Venue[]> {
    return this.repo.findByIds(ids);
  }

  categoryCounts(citySlug?: string): Promise<Record<string, number>> {
    return this.repo.categoryCounts(citySlug);
  }

  categories(): Array<{ value: string; label: string }> {
    return [
      { value: 'cafe', label: 'Cà phê' },
      { value: 'restaurant', label: 'Nhà hàng' },
      { value: 'street_food', label: 'Ẩm thực đường phố' },
      { value: 'bar', label: 'Bar & Nightlife' },
      { value: 'viewpoint', label: 'Ngắm cảnh' },
      { value: 'beach', label: 'Biển' },
      { value: 'homestay', label: 'Homestay' },
      { value: 'museum', label: 'Bảo tàng & Di tích' },
      { value: 'park', label: 'Công viên' },
      { value: 'shopping', label: 'Mua sắm' },
    ];
  }

  sitemapEntries(): Promise<Array<{ slug: string; updatedAt: Date }>> {
    return this.repo.sitemapEntries();
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
