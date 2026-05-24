import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import type { UserRole } from '../../database/entities';

// admin includes business, business includes user. @Roles('business') therefore
// admits both business and admin; @Roles('admin') admits admin only.
const HIERARCHY: Record<UserRole, number> = {
  user: 0,
  business: 1,
  admin: 2,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Authentication required');

    const minRequired = Math.min(...required.map((r) => HIERARCHY[r]));
    if (HIERARCHY[user.role] < minRequired) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
