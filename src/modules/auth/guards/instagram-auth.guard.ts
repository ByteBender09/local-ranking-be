import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtConfig } from '../../../config/configuration';
import { JwtPayload } from '../dto/auth.dto';

@Injectable()
export class InstagramAuthGuard extends AuthGuard('instagram') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = (req.query.token as string | undefined) ?? '';
    if (!token) throw new UnauthorizedException('Missing link token');

    try {
      const secret = this.config.get<JwtConfig>('jwt')!.secret;
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });
      return { state: payload.sub };
    } catch {
      throw new UnauthorizedException('Invalid link token');
    }
  }
}
