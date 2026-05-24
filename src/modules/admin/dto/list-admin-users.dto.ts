import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { USER_ROLES, type UserRole } from '../../../database/entities';

export const ADMIN_USER_SORT_OPTIONS = [
  'newest',
  'oldest',
  'name',
  'handle',
] as const;
export type AdminUserSort = (typeof ADMIN_USER_SORT_OPTIONS)[number];

export class ListAdminUsersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @IsOptional()
  @IsBooleanString()
  isBlocked?: 'true' | 'false';

  @IsOptional()
  @IsIn(ADMIN_USER_SORT_OPTIONS)
  sort: AdminUserSort = 'newest';

  @Type(() => Number)
  limit: number = 20;
}
