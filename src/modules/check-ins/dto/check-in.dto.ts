import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
