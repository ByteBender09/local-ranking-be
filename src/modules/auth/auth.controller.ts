import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InstagramAuthGuard } from './guards/instagram-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GoogleProfilePayload, InstagramLinkPayload } from './dto/auth.dto';
import { OAuthClientConfig } from '../../config/configuration';

@Controller('auth')
@Throttle({ auth: { ttl: 60_000, limit: 10 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
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
      const target = new URL(google.successRedirect);
      target.searchParams.set('token', session.accessToken);
      res.redirect(target.toString());
    } catch {
      res.redirect(google.failureRedirect);
    }
  }

  @SkipThrottle({ auth: true })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
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
}
