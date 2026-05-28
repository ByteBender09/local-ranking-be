import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  // Forward the mobile flag from the request query through the OAuth state
  // parameter so the callback knows whether to redirect back to the web
  // success URL (cookie) or the mobile custom scheme (token in query).
  getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const mobile = req.query?.mobile;
    const isMobile = mobile === '1' || mobile === 'true';
    return isMobile ? { state: 'mobile' } : {};
  }
}
