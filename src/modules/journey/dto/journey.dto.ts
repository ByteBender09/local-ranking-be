import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddJourneyDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class SeedJourneyDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  venueIds: string[];
}
