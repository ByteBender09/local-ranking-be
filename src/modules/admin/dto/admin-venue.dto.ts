import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
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

export class CreateAdminVenueDto {
  @IsString() @MaxLength(160) name: string;
  @IsIn(CATEGORIES) category: Category;
  @IsUUID() cityId: string;
  @IsString() @MaxLength(80) district: string;
  @IsString() @MaxLength(240) address: string;
  @IsString() @MaxLength(5_000) description: string;
  @IsString() @MaxLength(64) hours: string;

  @IsOptional() @IsString() @MaxLength(500) website?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags: string[];

  @Type(() => Number)
  @IsInt() @Min(1) @Max(4)
  priceRange: number;

  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;

  @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateAdminVenueDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: Category;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(5_000) description?: string;
  @IsOptional() @IsString() @MaxLength(64) hours?: string;
  @IsOptional() @IsString() @MaxLength(500) website?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(4) priceRange?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lng?: number;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}
