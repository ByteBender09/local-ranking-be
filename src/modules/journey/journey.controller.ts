import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JourneyEntry } from '../../database/entities';
import { AddJourneyDto, SeedJourneyDto } from './dto/journey.dto';
import { JourneyService } from './journey.service';

@Controller('me/journey')
@UseGuards(JwtAuthGuard)
export class JourneyController {
  constructor(private readonly service: JourneyService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<JourneyEntry[]> {
    return this.service.list(user.id);
  }

  // NOTE: static routes ('seed') MUST be declared before dynamic ':slug'
  // — NestJS matches in declaration order, so POST /me/journey/seed used to
  // hit the add() handler with slug='seed' and 404.
  @Post('seed')
  async seed(
    @Body() body: SeedJourneyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ added: number }> {
    const added = await this.service.seed(user.id, body.venueIds);
    return { added };
  }

  @Post(':slug')
  add(
    @Param('slug') slug: string,
    @Body() body: AddJourneyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JourneyEntry> {
    return this.service.add(slug, user.id, body.note);
  }

  @Delete(':slug')
  @HttpCode(204)
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.remove(slug, user.id);
  }
}
