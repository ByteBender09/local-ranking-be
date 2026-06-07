import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AiSearchRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  query: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  currentCitySlug?: string;
}

export class AiSearchMoreDto {
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  query: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  currentCitySlug?: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  offset: number;

  @IsInt()
  @Min(1)
  @Max(24)
  limit: number;
}
