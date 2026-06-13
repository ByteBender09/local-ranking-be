import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CheckIn } from '../../database/entities';
import {
  CreateCheckInDto,
  CreateCustomCheckInDto,
  UpdateMemoryDto,
} from './dto/check-in.dto';
import { CheckInsService } from './check-ins.service';
import { PublicUserDto } from '../users/dto/public-user.dto';

// Shape returned by GET check-ins/:id. Same as a CheckIn entity but with
// the author replaced by the public-safe DTO so private fields (email,
// access tokens, etc.) never leak through the public memory route.
type PublicCheckInDto = Omit<CheckIn, 'user'> & { user: PublicUserDto };

@Controller()
@UseGuards(JwtAuthGuard)
export class CheckInsController {
  constructor(private readonly service: CheckInsService) {}

  @Get('me/check-ins')
  myCheckIns(@CurrentUser() user: AuthenticatedUser): Promise<CheckIn[]> {
    return this.service.listByUser(user.id);
  }

  // Single-memory lookup powering the web's /m/[id] share page. Public to
  // anonymous callers; OptionalJwtAuthGuard populates req.user when a JWT
  // cookie IS present so an author can view their own private memory. The
  // service returns null for both "not found" and "private + not owner";
  // we map both to 404 so existence never leaks.
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('check-ins/:id')
  async byId(
    @Param('id') id: string,
    @CurrentUser() viewer: AuthenticatedUser | undefined,
  ): Promise<PublicCheckInDto> {
    const ci = await this.service.findByIdForViewer(id, viewer?.id);
    if (!ci) throw new NotFoundException('Memory not found');
    // Strip sensitive User columns before exposing the author publicly.
    const { user, ...rest } = ci;
    return { ...rest, user: PublicUserDto.from(user) };
  }

  @Post('venues/slug/:slug/check-in')
  create(
    @Param('slug') slug: string,
    @Body() body: CreateCheckInDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckIn> {
    return this.service.create(slug, user.id, body);
  }

  // Check in at a custom place not in the venues catalog (trip feature).
  @Post('check-ins/custom')
  createCustom(
    @Body() body: CreateCustomCheckInDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckIn> {
    return this.service.createCustom(user.id, body);
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
