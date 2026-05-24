import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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

export const ADMIN_VENUE_SORT_OPTIONS = [
  'newest',
  'oldest',
  'upvotes',
  'name',
] as const;
export type AdminVenueSort = (typeof ADMIN_VENUE_SORT_OPTIONS)[number];

export class ListAdminVenuesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  citySlug?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: Category;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsBooleanString()
  isPublished?: 'true' | 'false';

  @IsOptional()
  @IsIn(ADMIN_VENUE_SORT_OPTIONS)
  sort: AdminVenueSort = 'newest';

  @Type(() => Number)
  limit: number = 20;
}
