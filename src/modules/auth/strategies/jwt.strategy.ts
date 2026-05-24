import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../../../config/configuration';
import { JwtPayload } from '../dto/auth.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

export const ACCESS_TOKEN_COOKIE = 'hnd_token';

const fromCookie = (req: Request): string | null => {
  const raw = (req?.cookies as Record<string, string> | undefined)?.[
    ACCESS_TOKEN_COOKIE
  ];
  return raw ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      // Cookie first (browsers), then Authorization header (mobile / server).
      jwtFromRequest: ExtractJwt.fromExtractors([
        fromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<JwtConfig>('jwt')!.secret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return { id: payload.sub, handle: payload.handle, role: payload.role };
  }
}
