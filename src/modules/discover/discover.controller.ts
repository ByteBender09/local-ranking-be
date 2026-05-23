import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Venue } from '../../database/entities';
import { DiscoverService } from './discover.service';

@Controller('discover')
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  @Public()
  @Get('trending')
  trending(
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<Venue[]> {
    return this.discover.trending(this.clamp(limit));
  }

  @Public()
  @Get('recently-liked')
  recentlyLiked(
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<Venue[]> {
    return this.discover.recentlyLiked(this.clamp(limit));
  }

  @Public()
  @Get('editors-pick')
  editorsPick(
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<Venue[]> {
    return this.discover.editorsPick(this.clamp(limit));
  }

  @Public()
  @Get('hidden-gems')
  hiddenGems(
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<Venue[]> {
    return this.discover.hiddenGems(this.clamp(limit));
  }

  @UseGuards(JwtAuthGuard)
  @Get('for-me')
  forMe(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<Venue[]> {
    return this.discover.recommendForUser(user.id, this.clamp(limit));
  }

  private clamp(n: number): number {
    return Math.min(Math.max(n, 1), 30);
  }
}
