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

  @Patch('venues/slug/:slug/check-in/memory')
  updateMemory(
    @Param('slug') slug: string,
    @Body() body: UpdateMemoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CheckIn> {
    return this.service.updateMemory(slug, user.id, body);
  }

  @Delete('venues/slug/:slug/check-in')
  @HttpCode(204)
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.remove(slug, user.id);
  }
}
