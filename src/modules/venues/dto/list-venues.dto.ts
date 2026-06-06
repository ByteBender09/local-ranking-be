import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import type { Category } from '../../../database/entities';

const CATEGORIES: Category[] = [
  'cafe',
  'restaurant',
  'street_food',
  'viewpoint',
  'beach',
  'homestay',
  'bar',
  'museum',
  'park',
  'shopping',
];

export const SORT_OPTIONS = ['upvotes', 'rating', 'newest'] as const;
export type VenueSort = (typeof SORT_OPTIONS)[number];

export class ListVenuesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  citySlug?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: Category;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  // Post-2025 ward filter — accepts EITHER a canonical ward name (e.g.
  // "Phú Xuân", "Bến Thành") OR an old district name (e.g. "Quận 3",
  // "Hoàn Kiếm"). VenuesService expands aliases via WardNormalizerService
  // before hitting the repo, so a single query like ward=Quận+3 returns
  // every venue across all new wards that absorbed District 3 territory.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ward?: string;

  // Free-text search across name/district/address/tags. Combined with the
  // other filters (citySlug, category) on the same listing endpoint so the
  // in-city quick-filter on the FE can paginate matching results — instead of
  // only narrowing the page already loaded.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(SORT_OPTIONS)
  sort: VenueSort = 'upvotes';
}

export class SearchVenuesDto {
  @IsString()
  @MaxLength(80)
  q: string;

  @Type(() => Number)
  @IsOptional()
  limit: number = 8;
}
