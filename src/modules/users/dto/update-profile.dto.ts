import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UserSocialsDto {
  @IsOptional() @IsString() @MaxLength(80) instagram?: string;
  @IsOptional() @IsString() @MaxLength(80) tiktok?: string;
  @IsOptional() @IsString() @MaxLength(80) youtube?: string;
  @IsOptional() @IsString() @MaxLength(80) threads?: string;
  @IsOptional() @IsString() @MaxLength(80) facebook?: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(40) name?: string;
  // User-editable display name override. Empty string clears it.
  @IsOptional() @IsString() @MaxLength(40) nickname?: string;
  @IsOptional() @IsString() @MaxLength(280) bio?: string;
  @IsOptional() @IsBoolean() bookingEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bookingPriceVnd?: number;

  @IsOptional()
  @IsObject()
  @Type(() => UserSocialsDto)
  socials?: UserSocialsDto;

  @IsOptional() @IsString() @MaxLength(80) citySlug?: string;
}
