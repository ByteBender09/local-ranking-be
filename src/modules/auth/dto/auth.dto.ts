import type { UserRole } from '../../../database/entities';

export interface JwtPayload {
  sub: string;
  handle: string;
  role: UserRole;
}

export interface AuthSession {
  accessToken: string;
  user: {
    id: string;
    handle: string;
    name: string;
    avatar: string;
    role: UserRole;
  };
}

export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  name: string;
  avatar: string;
}

export interface InstagramLinkPayload {
  instagramUserId: string;
  username: string;
  accessToken: string;
}
