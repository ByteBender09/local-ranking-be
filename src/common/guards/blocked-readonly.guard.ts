import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../../database/entities';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Blocked users can read but cannot mutate. Admins are exempt so they can still
 * unblock themselves if locked out by mistake (defensive — UI should prevent
 * self-block but the guard is the last line of defense).
 */
@Injectable()
export class BlockedReadOnlyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser }
    >();
    if (READ_METHODS.has(req.method)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const auth = req.user;
    if (!auth) return true; // JwtAuthGuard will reject if needed.
    if (auth.role === 'admin') return true;

    const fresh = await this.users.findOne({
      where: { id: auth.id },
      select: ['id', 'isBlocked'],
    });
    if (fresh?.isBlocked) {
      throw new ForbiddenException(
        'Tài khoản của bạn đang bị tạm khóa — chỉ có thể xem.',
      );
    }
    return true;
  }
}
