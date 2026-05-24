import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { MailConfig } from '../../config/configuration';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateBrandingDto } from './dto/branding.dto';
import { BrandingResponse, BrandingService } from './branding.service';

@Controller()
export class BrandingController {
  constructor(
    private readonly svc: BrandingService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business', 'admin')
  @Get('me/branding')
  get(@CurrentUser() user: AuthenticatedUser): Promise<BrandingResponse> {
    return this.svc.get(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business', 'admin')
  @Put('me/branding')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateBrandingDto,
  ): Promise<BrandingResponse> {
    return this.svc.update(user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business', 'admin')
  @Post('me/branding/send-verification')
  sendVerification(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ sent: boolean }> {
    return this.svc.sendVerification(user.id);
  }

  // Public — clicked from the verification email. Redirects back to the FE
  // with a status the page can render.
  @Public()
  @Get('branding/verify')
  async verify(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const m = this.config.get<MailConfig>('mail')!;
    const base = m.appPublicUrl.replace(/\/$/, '');
    const result = await this.svc.verifyToken(token ?? '');
    const status = result.ok ? 'verified' : (result.reason ?? 'invalid');
    res.redirect(`${base}/me/branding?verify=${status}`);
  }
}
