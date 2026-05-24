import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InstagramAuthGuard } from './guards/instagram-auth.guard';
import { ACCESS_TOKEN_COOKIE } from './strategies/jwt.strategy';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GoogleProfilePayload, InstagramLinkPayload } from './dto/auth.dto';
import {
  AppConfig,
  OAuthClientConfig,
} from '../../config/configuration';
import { User } from '../../database/entities';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
@Throttle({ auth: { ttl: 60_000, limit: 10 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleStart(): void {}

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request & { user: GoogleProfilePayload },
    @Res() res: Response,
  ): Promise<void> {
    const google = this.config.get<OAuthClientConfig>('google')!;
    try {
      const user = await this.authService.findOrCreateGoogleUser(req.user);
      const session = this.authService.issueSession(user);
      this.setAccessCookie(res, session.accessToken);
      res.redirect(google.successRedirect);
    } catch {
      res.redirect(google.failureRedirect);
    }
  }

  @SkipThrottle({ auth: true })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() actor: AuthenticatedUser): Promise<{
    id: string;
    handle: string;
    name: string;
    avatar: string;
    role: string;
    bio: string;
    instagramHandle: string | null;
    bookingEnabled: boolean;
    bookingPriceVnd: number | null;
  }> {
    const u = await this.users.findOneOrFail({ where: { id: actor.id } });
    return {
      id: u.id,
      handle: u.handle,
      name: u.name,
      avatar: u.avatar,
      role: u.role,
      bio: u.bio,
      instagramHandle: u.instagramHandle,
      bookingEnabled: u.bookingEnabled,
      bookingPriceVnd: u.bookingPriceVnd,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions());
  }

  @UseGuards(JwtAuthGuard)
  @Post('instagram/token')
  issueInstagramLinkToken(@CurrentUser() user: AuthenticatedUser): {
    token: string;
  } {
    return { token: this.authService.issueLinkToken(user) };
  }

  @Public()
  @Get('instagram')
  @UseGuards(InstagramAuthGuard)
  instagramStart(@Query('token') _token: string): void {}

  @Public()
  @Get('instagram/callback')
  @UseGuards(InstagramAuthGuard)
  async instagramCallback(
    @Req()
    req: Request & { user: InstagramLinkPayload; query: { state?: string } },
    @Res() res: Response,
  ): Promise<void> {
    const ig = this.config.get<OAuthClientConfig>('instagram')!;
    const userId = req.query.state;
    if (!userId) {
      res.redirect(ig.failureRedirect);
      return;
    }
    try {
      await this.authService.linkInstagram(userId, req.user);
      res.redirect(ig.successRedirect);
    } catch {
      res.redirect(ig.failureRedirect);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('instagram/unlink')
  async unlinkInstagram(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.authService.unlinkInstagram(user.id);
    return { ok: true };
  }

  private setAccessCookie(res: Response, token: string): void {
    res.cookie(ACCESS_TOKEN_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: ONE_WEEK_MS,
    });
  }

  private cookieOptions() {
    const app = this.config.get<AppConfig>('app')!;
    const isProd = app.nodeEnv === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('lax' as const) : ('lax' as const),
      path: '/',
    };
  }
}
