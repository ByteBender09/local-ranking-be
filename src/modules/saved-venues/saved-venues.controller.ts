import {
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
import { SavedVenue } from '../../database/entities';
import { SavedVenuesService } from './saved-venues.service';

@Controller('me/saved')
@UseGuards(JwtAuthGuard)
export class SavedVenuesController {
  constructor(private readonly service: SavedVenuesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<SavedVenue[]> {
    return this.service.list(user.id);
  }

  @Post(':slug')
  add(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SavedVenue> {
    return this.service.add(slug, user.id);
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
