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
