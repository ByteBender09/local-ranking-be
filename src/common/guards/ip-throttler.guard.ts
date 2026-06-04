import { ExecutionContext, Injectable } from '@nestjs/common';
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

  // Trusted internal caller (the Next.js frontend during server-side rendering)
  // is exempt. Every public detail/list page is rendered on the FE server, so
  // ALL of its SSR/ISR fetches egress from a single IP and would otherwise share
  // one throttle bucket — a handful of cold-cache pages regenerating at once
  // (e.g. a crawler sweeping freshly-imported venues) blew past the per-IP
  // limit and surfaced as HTTP 500s on the venue pages. The FE attaches
  // `x-internal-token` only on server-side requests (never exposed to the
  // browser), so real public clients are still rate-limited normally.
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const expected = process.env.INTERNAL_API_TOKEN;
    if (expected) {
      const req = context.switchToHttp().getRequest<Request>();
      const token = req.headers['x-internal-token'];
      if (typeof token === 'string' && token === expected) return true;
    }
    return super.shouldSkip(context);
  }
}
