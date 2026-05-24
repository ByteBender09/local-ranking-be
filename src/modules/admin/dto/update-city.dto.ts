import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import type { Region } from '../../../database/entities';

export class UpdateCityDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) nameEn?: string;
  @IsOptional() @IsIn(['north', 'central', 'south']) region?: Region;
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(500) coverImage?: string;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(2_000) description?: string;
  @IsOptional() highlights?: string[];
  @IsOptional() lat?: number | null;
  @IsOptional() lng?: number | null;
}
