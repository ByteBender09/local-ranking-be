import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CheckIn } from '../../database/entities';
import { CreateCheckInDto, UpdateMemoryDto } from './dto/check-in.dto';
import { CheckInsService } from './check-ins.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class CheckInsController {
  constructor(private readonly service: CheckInsService) {}

  @Get('me/check-ins')
  myCheckIns(@CurrentUser() user: AuthenticatedUser): Promise<CheckIn[]> {
    return this.service.listByUser(user.id);
  }

  @Post('venues/slug/:slug/check-in')
  create(
    @Param('slug') slug: string,
    @Body() body: CreateCheckInDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckIn> {
    return this.service.create(slug, user.id, body);
  }

  // Slug-based convenience routes act on the user's latest check-in at a venue
  // (one-memory-per-venue clients like the web). Subject to the 30-minute lock.
  @Patch('venues/slug/:slug/check-in/memory')
  updateLatestMemory(
    @Param('slug') slug: string,
    @Body() body: UpdateMemoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckIn> {
    return this.service.updateLatestMemory(slug, user.id, body);
  }

  @Delete('venues/slug/:slug/check-in')
  @HttpCode(204)
  async removeLatest(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.removeLatest(slug, user.id);
  }

  // Memory edit/delete target a specific check-in by id, since a venue can now
  // be checked in multiple times.
  @Patch('me/check-ins/:id/memory')
  updateMemory(
    @Param('id') id: string,
    @Body() body: UpdateMemoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckIn> {
    return this.service.updateMemory(id, user.id, body);
  }

  @Delete('me/check-ins/:id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.remove(id, user.id);
  }
}
