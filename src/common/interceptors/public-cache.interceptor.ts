import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  PUBLIC_CACHE_KEY,
  PublicCacheOptions,
} from '../decorators/public-cache.decorator';

@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.getAllAndOverride<PublicCacheOptions>(
      PUBLIC_CACHE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!opts) return next.handle();

    const req = ctx.switchToHttp().getRequest<{ method: string }>();
    if (req.method !== 'GET') return next.handle();

    const res = ctx.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        if (res.headersSent) return;
        res.setHeader(
          'Cache-Control',
          `public, s-maxage=${opts.sMaxAge}, stale-while-revalidate=${opts.staleWhileRevalidate}`,
        );
        res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
      }),
    );
  }
}
