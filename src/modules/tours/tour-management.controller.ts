import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Tour, TourPromotion } from '../../database/entities';
import {
  CreateTourDto,
  UpdateTourDto,
  UpsertPromotionDto,
} from './dto/tour-management.dto';
import { TourManagementService } from './tour-management.service';

// Tour creation/editing is ADMIN-ONLY. Businesses no longer self-manage tours
// or branding from the public site — an admin creates the brand and the tours
// on their behalf (assigning ownerId). See AdminToursController for the admin
// listing/publish/delete surface; this controller holds the write operations.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class TourManagementController {
  constructor(private readonly service: TourManagementService) {}

  // Admin tour listing (with itinerary + brand). Kept at this path for the
  // existing client; returns ALL tours since management is admin-only now.
  @Get('me/tours')
  listAll(): Promise<Tour[]> {
    return this.service.listAll();
  }

  @Post('tours')
  create(
    @Body() body: CreateTourDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tour> {
    return this.service.create(user, body);
  }

  @Patch('tours/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTourDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tour> {
    return this.service.update(user, id, body);
  }

  @Delete('tours/:id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.remove(user, id);
  }

  @Post('tours/:id/promotions')
  addPromotion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpsertPromotionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TourPromotion> {
    return this.service.addPromotion(user, id, body);
  }

  @Put('tours/:id/promotions/:promotionId')
  updatePromotion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('promotionId', ParseUUIDPipe) promotionId: string,
    @Body() body: UpsertPromotionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TourPromotion> {
    return this.service.updatePromotion(user, id, promotionId, body);
  }

  @Delete('tours/:id/promotions/:promotionId')
  @HttpCode(204)
  async removePromotion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('promotionId', ParseUUIDPipe) promotionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.removePromotion(user, id, promotionId);
  }
}
