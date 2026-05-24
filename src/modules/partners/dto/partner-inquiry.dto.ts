import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Allowed partnership types — mirrors the FE dropdown. Keep both in sync.
export const PARTNERSHIP_TYPES = [
  'Tour guide',
  'Công ty lữ hành',
  'Khách sạn / Homestay',
  'Quán ăn / Café',
  'Local brand',
  'Khác',
] as const;
export type PartnershipType = (typeof PARTNERSHIP_TYPES)[number];

export class PartnerInquiryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  organization?: string;

  @IsString()
  @IsIn(PARTNERSHIP_TYPES as unknown as string[])
  partnershipType!: PartnershipType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}
