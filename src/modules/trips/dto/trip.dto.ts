import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TripVisibility } from '../../../database/entities';

const VISIBILITIES: TripVisibility[] = ['private', 'followers', 'public'];

export class CreateTripDto {
  @IsString() @MaxLength(120) title: string;

  @IsDateString() startDate: string;

  @IsDateString() endDate: string;

  // Ordered city stops. First = start, last = end. At least one required.
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  destinationCityIds: string[];

  @IsOptional() @IsString() @MaxLength(500) coverImage?: string;

  @IsOptional() @IsIn(VISIBILITIES) visibility?: TripVisibility;
}

export class UpdateTripDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;

  @IsOptional() @IsDateString() startDate?: string;

  @IsOptional() @IsDateString() endDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  destinationCityIds?: string[];

  @IsOptional() @IsString() @MaxLength(500) coverImage?: string;

  @IsOptional() @IsIn(VISIBILITIES) visibility?: TripVisibility;
}

export class InviteMembersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  userIds: string[];
}

export class RespondInviteDto {
  @IsBoolean() accept: boolean;
}

export class TransferOwnerDto {
  @IsUUID() userId: string;
}
