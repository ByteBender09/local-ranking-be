import { SetMetadata } from '@nestjs/common';

export const PUBLIC_CACHE_KEY = 'publicCache';

export interface PublicCacheOptions {
  sMaxAge: number;
  staleWhileRevalidate: number;
}

export const PublicCache = (
  opts: PublicCacheOptions,
): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_CACHE_KEY, opts);
