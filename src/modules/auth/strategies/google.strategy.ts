import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { OAuthClientConfig } from '../../../config/configuration';
import { GoogleProfilePayload } from '../dto/auth.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const google = config.get<OAuthClientConfig>('google')!;
    super({
      clientID: google.clientId || 'missing-google-client-id',
      clientSecret: google.clientSecret || 'missing-google-client-secret',
      callbackURL: google.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value ?? '';
    const avatar = profile.photos?.[0]?.value ?? '';
    const payload: GoogleProfilePayload = {
      googleId: profile.id,
      email,
      name: profile.displayName || email.split('@')[0] || 'Khách',
      avatar,
    };
    done(null, payload);
  }
}
