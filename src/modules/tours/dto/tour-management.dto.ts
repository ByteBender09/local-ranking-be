import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  ValidateNested,
} from 'class-validator';
import type { Category } from '../../../database/entities';

// One ordered stop in a tour itinerary. The city is mandatory; the venue is
// optional (a "just the city" stop). Position is the array index — clients
// send stops in visiting order.
export class TourStopDto {
  @IsUUID() cityId: string;
  @IsOptional() @IsUUID() venueId?: string;
}

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
  @IsIn(CATEGORIES) category: Category;

  // Itinerary stops in visiting order. At least one. The first stop's city
  // becomes the tour's primary city; 2+ distinct cities ⇒ inter_province.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TourStopDto)
  stops: TourStopDto[];

  // Which brand provides this tour. null/omitted ⇒ system tour (SITE_PROVIDER).
  @IsOptional() @IsUUID() brandId?: string;

  // Up to 30 days to accommodate multi-city inter-province itineraries.
  @Type(() => Number) @IsInt() @Min(1) @Max(720) durationHours: number;
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

}

export class UpdateTourDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: Category;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(720) durationHours?: number;
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

  // Reassign the providing brand. null ⇒ system tour.
  @IsOptional() @IsUUID() brandId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  highlights?: string[];

  // Optional on a partial update, but if provided the itinerary must keep at
  // least one stop — a tour can never be left with zero stops.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TourStopDto)
  stops?: TourStopDto[];
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
