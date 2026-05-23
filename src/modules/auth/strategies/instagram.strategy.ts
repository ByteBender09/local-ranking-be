import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import axios from 'axios';
import { OAuthClientConfig } from '../../../config/configuration';
import { InstagramLinkPayload } from '../dto/auth.dto';

@Injectable()
export class InstagramStrategy extends PassportStrategy(Strategy, 'instagram') {
  constructor(config: ConfigService) {
    const ig = config.get<OAuthClientConfig>('instagram')!;
    super({
      authorizationURL: 'https://api.instagram.com/oauth/authorize',
      tokenURL: 'https://api.instagram.com/oauth/access_token',
      clientID: ig.clientId || 'missing-instagram-client-id',
      clientSecret: ig.clientSecret || 'missing-instagram-client-secret',
      callbackURL: ig.callbackUrl,
      scope: ['user_profile'],
      state: true,
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    _params: unknown,
    _profile: unknown,
    done: (err: Error | null, user?: InstagramLinkPayload) => void,
  ): Promise<void> {
    try {
      const { data } = await axios.get<{ id: string; username: string }>(
        'https://graph.instagram.com/me',
        {
          params: { fields: 'id,username', access_token: accessToken },
          timeout: 5_000,
        },
      );
      done(null, {
        instagramUserId: data.id,
        username: data.username,
        accessToken,
      });
    } catch (err) {
      done(err as Error);
    }
  }
}
