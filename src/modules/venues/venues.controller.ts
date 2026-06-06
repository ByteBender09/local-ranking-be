import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Param,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { Venue } from '../../database/entities';
import { ListVenuesDto } from './dto/list-venues.dto';
import { VenuesService } from './venues.service';

@Controller('venues')
@Public()
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  list(@Query() filter: ListVenuesDto): Promise<PaginatedResponse<Venue>> {
    return this.venues.list(filter);
  }

  @Get('trending')
  trending(
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ): Promise<Venue[]> {
    return this.venues.trending(Math.min(Math.max(limit, 1), 50));
  }

  @Get('search')
  search(
    @Query('q', new DefaultValuePipe('')) q: string,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<Venue[]> {
    return this.venues.search(q, Math.min(Math.max(limit, 1), 30));
  }

  // Batch-resolve venues by id (comma-separated). Used by the tour editor's
  // VenuePicker to render chips for already-selected venues on first load.
  // Declared before ':slug' so the static path wins the route match.
  @Get('by-ids')
  byIds(@Query('ids', new DefaultValuePipe('')) ids: string): Promise<Venue[]> {
    const list = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    return this.venues.byIds(list);
  }

  // Total venue count per category for the category chips (real totals, not
  // just what's been rendered). Declared before ':slug'.
  @Get('category-counts')
  categoryCounts(
    @Query('citySlug') citySlug?: string,
  ): Promise<Record<string, number>> {
    return this.venues.categoryCounts(citySlug);
  }

  // All published venue slugs + updatedAt for the sitemap. Lightweight (no
  // heavy columns) so the FE can list every venue, not just the first page.
  // Declared before ':slug' so the static path wins the route match.
  @Get('sitemap')
  sitemap(): Promise<Array<{ slug: string; updatedAt: Date }>> {
    return this.venues.sitemapEntries();
  }

  // Canonical post-2025 wards in a city, for ward-filter UI. Each entry
  // includes the old district name(s) it covers so the chip can render
  // "Bến Thành (was Quận 1)". Declared before ':slug'.
  @Get('wards')
  wards(
    @Query('citySlug') citySlug: string,
  ): Promise<Array<{ name: string; type: string; aliasesOldDistrict: string[] }>> {
    return this.venues.wardsForCity(citySlug);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string): Promise<Venue> {
    return this.venues.getBySlug(slug);
  }
}
