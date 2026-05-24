import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const ADMIN_TOUR_SORT_OPTIONS = [
  'newest',
  'oldest',
  'price-high',
  'price-low',
  'title',
] as const;
export type AdminTourSort = (typeof ADMIN_TOUR_SORT_OPTIONS)[number];

export class ListAdminToursDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  citySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsBooleanString()
  verified?: 'true' | 'false';

  @IsOptional()
  @IsBooleanString()
  isPublished?: 'true' | 'false';

  @IsOptional()
  @IsIn(ADMIN_TOUR_SORT_OPTIONS)
  sort: AdminTourSort = 'newest';

  @Type(() => Number)
  limit: number = 20;
}
