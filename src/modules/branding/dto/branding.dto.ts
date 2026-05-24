import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  brandShortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brandLogoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  brandDescription?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  brandWebsiteUrl?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  brandContactEmail?: string;
}
