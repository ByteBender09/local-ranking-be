import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCheckInDto {
  @IsOptional() @IsString() @MaxLength(2_000) comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @Type(() => String)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  friends?: string[];

  @IsOptional() @IsBoolean() isPublic?: boolean;
}

// A check-in at a custom place NOT in the venues catalog. Carries its own
// name + coordinates instead of a venue slug. Memory fields mirror
// CreateCheckInDto.
export class CreateCustomCheckInDto {
  @IsString() @IsNotEmpty() @MaxLength(160) placeName: string;

  @IsOptional() @IsString() @MaxLength(240) placeAddress?: string;

  @Type(() => Number) @IsLatitude() lat: number;

  @Type(() => Number) @IsLongitude() lng: number;

  @IsOptional() @IsString() @MaxLength(2_000) comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @Type(() => String)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  friends?: string[];

  @IsOptional() @IsBoolean() isPublic?: boolean;
}

export class UpdateMemoryDto {
  @IsOptional() @IsString() @MaxLength(2_000) comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @Type(() => String)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  friends?: string[];

  @IsOptional() @IsBoolean() isPublic?: boolean;
}
