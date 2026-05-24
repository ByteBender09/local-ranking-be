import { IsIn } from 'class-validator';
import { USER_ROLES, UserRole } from '../../../database/entities';

export class ChangeRoleDto {
  @IsIn(USER_ROLES)
  role: UserRole;
}
