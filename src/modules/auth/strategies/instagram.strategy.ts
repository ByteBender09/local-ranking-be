import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import axios from 'axios';
import { OAuthClientConfig } from '../../../config/configuration';
import { InstagramLinkPayload } from '../dto/auth.dto';

// Meta sunset Instagram Basic Display on 2024-12-04. The replacement product
// — "Instagram Login" (a.k.a. Instagram Business Login via Instagram Graph
// API) — uses a different authorize URL and scope set, but reuses the same
// token endpoint. The token response now carries `user_id` and `permissions`
// alongside `access_token`, and `graph.instagram.com/me` is still valid for
// the linked account's username (with explicit API version).
@Injectable()
export class InstagramStrategy extends PassportStrategy(Strategy, 'instagram') {
  constructor(config: ConfigService) {
    const ig = config.get<OAuthClientConfig>('instagram')!;
    super({
      authorizationURL: 'https://www.instagram.com/oauth/authorize',
      tokenURL: 'https://api.instagram.com/oauth/access_token',
      clientID: ig.clientId || 'missing-instagram-client-id',
      clientSecret: ig.clientSecret || 'missing-instagram-client-secret',
      callbackURL: ig.callbackUrl,
      scope: ['instagram_business_basic'],
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
        'https://graph.instagram.com/v23.0/me',
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
