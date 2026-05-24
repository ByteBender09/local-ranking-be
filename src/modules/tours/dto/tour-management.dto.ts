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
  IsUrl,
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

export class CreateTourDto {
  @IsString() @MaxLength(200) title: string;
  @IsUUID() cityId: string;
  @IsIn(CATEGORIES) category: Category;

  @Type(() => Number) @IsInt() @Min(1) @Max(72) durationHours: number;
  @Type(() => Number) @IsInt() @Min(0) priceVnd: number;

  // Image is now optional. When missing the service falls back to the first
  // entry of `images`, then the owner's brand logo, so tours always have a
  // sensible visual without forcing a hero upload per tour.
  @IsOptional() @IsString() @MaxLength(500) image?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsString() @MaxLength(5_000) description?: string;

  @IsOptional() @IsUrl() @MaxLength(500) bookingUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  venueIds?: string[];
}

export class UpdateTourDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: Category;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(72) durationHours?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceVnd?: number;
  @IsOptional() @IsString() @MaxLength(500) image?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsString() @MaxLength(5_000) description?: string;
  @IsOptional() @IsUrl() @MaxLength(500) bookingUrl?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  venueIds?: string[];
}

export class UpsertPromotionDto {
  @IsString() @MaxLength(120) title: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(40) code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @IsOptional() @IsUrl() @MaxLength(500) url?: string;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validTo?: string;
}
