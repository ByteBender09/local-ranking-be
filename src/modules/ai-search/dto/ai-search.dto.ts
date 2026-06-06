import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AiSearchRequestDto {
  // Max length keeps a malicious 10KB query from blowing through LLM
  // token limits + cache row size. 240 is a comfortable upper bound on
  // any natural-language sentence a user might type.
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  query: string;

  // Optional. FE sends this when the user has granted geolocation AND
  // hasn't named a city in the query — the service uses it as the default
  // city scope so "tìm quán cafe chilling" near a user in Đà Lạt actually
  // returns Đà Lạt cafes instead of falling through to all-of-Vietnam.
  // Slug must match an existing city; service silently ignores otherwise.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  currentCitySlug?: string;
}
