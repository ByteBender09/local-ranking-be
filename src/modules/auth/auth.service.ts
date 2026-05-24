import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthConfig } from '../../config/configuration';
import { User, UserRole } from '../../database/entities';
import {
  AuthSession,
  GoogleProfilePayload,
  InstagramLinkPayload,
  JwtPayload,
} from './dto/auth.dto';

const cleanHandle = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9.]/g, '')
    .slice(0, 24);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async findOrCreateGoogleUser(profile: GoogleProfilePayload): Promise<User> {
    const adminEmails = this.config.get<AuthConfig>('auth')!.adminEmails;
    const desiredRole: UserRole =
      profile.email && adminEmails.includes(profile.email.toLowerCase())
        ? 'admin'
        : 'user';

    const existing =
      (await this.users.findOne({ where: { googleId: profile.googleId } })) ||
      (profile.email
        ? await this.users.findOne({ where: { email: profile.email } })
        : null);

    if (existing) {
      let dirty = false;
      if (!existing.googleId) {
        existing.googleId = profile.googleId;
        dirty = true;
      }
      if (profile.avatar && existing.avatar !== profile.avatar) {
        existing.avatar = profile.avatar;
        dirty = true;
      }
      // Auto-promote configured admin emails on every login, but never demote.
      if (desiredRole === 'admin' && existing.role !== 'admin') {
        existing.role = 'admin';
        dirty = true;
      }
      if (dirty) await this.users.save(existing);
      return existing;
    }

    const baseHandle =
      cleanHandle(profile.email.split('@')[0] || '') || `user${Date.now()}`;
    const handle = await this.uniqueHandle(baseHandle);

    const user = this.users.create({
      googleId: profile.googleId,
      email: profile.email || null,
      handle,
      name: profile.name,
      avatar:
        profile.avatar ||
        `https://picsum.photos/seed/avatar-${handle}/200/200`,
      bio: '',
      socials: {},
      role: desiredRole,
    });
    return this.users.save(user);
  }

  private async uniqueHandle(base: string): Promise<string> {
    let h = base;
    let i = 1;
    while (await this.users.exists({ where: { handle: h } })) {
      i += 1;
      h = `${base}${i}`;
    }
    return h;
  }

  issueSession(user: User): AuthSession {
    const payload: JwtPayload = {
      sub: user.id,
      handle: user.handle,
      role: user.role,
    };
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        handle: user.handle,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
    };
  }

  issueLinkToken(user: { id: string; handle: string; role: UserRole }): string {
    return this.jwt.sign(
      { sub: user.id, handle: user.handle, role: user.role },
      { expiresIn: '10m' },
    );
  }

  async linkInstagram(
    userId: string,
    payload: InstagramLinkPayload,
  ): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    user.instagramUserId = payload.instagramUserId;
    user.instagramHandle = payload.username;
    user.instagramAccessToken = payload.accessToken;
    user.instagramLinkedAt = new Date();
    user.socials = { ...(user.socials ?? {}), instagram: payload.username };
    return this.users.save(user);
  }

  async unlinkInstagram(userId: string): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    user.instagramUserId = null;
    user.instagramHandle = null;
    user.instagramAccessToken = null;
    user.instagramLinkedAt = null;
    const { instagram: _ignored, ...rest } = user.socials ?? {};
    user.socials = rest;
    return this.users.save(user);
  }
}
