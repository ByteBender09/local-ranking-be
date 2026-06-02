import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const ADMIN_BRAND_SORT_OPTIONS = [
  'newest',
  'oldest',
  'tours',
  'name',
] as const;
export type AdminBrandSort = (typeof ADMIN_BRAND_SORT_OPTIONS)[number];

export class ListAdminBrandsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsBooleanString()
  verified?: 'true' | 'false';

  @IsOptional()
  @IsIn(ADMIN_BRAND_SORT_OPTIONS)
  sort: AdminBrandSort = 'newest';

  @Type(() => Number)
  limit: number = 20;
}

export class CreateAdminBrandDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsString() @MinLength(2) @MaxLength(16) shortName: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(500) websiteUrl?: string;
  @IsOptional() @IsEmail() @MaxLength(200) contactEmail?: string;
}

export class UpdateAdminBrandDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(16) shortName?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(500) websiteUrl?: string;
  @IsOptional() @IsEmail() @MaxLength(200) contactEmail?: string;
}
