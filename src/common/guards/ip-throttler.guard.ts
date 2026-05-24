import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

// Keys throttling on the real client IP. When TRUST_PROXY is set in main.ts,
// Express resolves req.ip from X-Forwarded-For, so the same identity is used
// behind any load balancer or CDN.
@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }
}
