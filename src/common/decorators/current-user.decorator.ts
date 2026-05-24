import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import type { UserRole } from '../../database/entities';

export interface AuthenticatedUser {
  id: string;
  handle: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    return req.user;
  },
);
