import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { City, Venue } from '../../database/entities';
import { UpdateCityDto } from './dto/update-city.dto';
import {
  CreateAdminVenueDto,
  UpdateAdminVenueDto,
} from './dto/admin-venue.dto';
import { ListAdminVenuesDto } from './dto/list-admin-venues.dto';
import { AdminCitiesVenuesService } from './admin-venues.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminCitiesVenuesController {
  constructor(private readonly svc: AdminCitiesVenuesService) {}

  // Cities ---------------------------------------------------------

  @Get('cities')
  listCities(): Promise<City[]> {
    return this.svc.listCities();
  }

  @Get('cities/:slug')
  getCity(@Param('slug') slug: string): Promise<City> {
    return this.svc.getCity(slug);
  }

  @Patch('cities/:slug')
  updateCity(
    @Param('slug') slug: string,
    @Body() dto: UpdateCityDto,
  ): Promise<City> {
    return this.svc.updateCity(slug, dto);
  }

  // Venues ---------------------------------------------------------

  @Get('cities/:slug/venues')
  listVenuesByCity(@Param('slug') slug: string): Promise<Venue[]> {
    return this.svc.listVenuesByCity(slug);
  }

  @Get('venues')
  listVenues(
    @Query() filter: ListAdminVenuesDto,
  ): Promise<PaginatedResponse<Venue>> {
    return this.svc.listVenuesPaged(filter);
  }

  @Get('venues/:slug')
  getVenue(@Param('slug') slug: string): Promise<Venue> {
    return this.svc.getVenue(slug);
  }

  @Post('venues')
  createVenue(@Body() dto: CreateAdminVenueDto): Promise<Venue> {
    return this.svc.createVenue(dto);
  }

  @Patch('venues/:slug')
  updateVenue(
    @Param('slug') slug: string,
    @Body() dto: UpdateAdminVenueDto,
  ): Promise<Venue> {
    return this.svc.updateVenue(slug, dto);
  }

  @Patch('venues/:slug/publish')
  publish(@Param('slug') slug: string): Promise<Venue> {
    return this.svc.setPublished(slug, true);
  }

  @Patch('venues/:slug/unpublish')
  unpublish(@Param('slug') slug: string): Promise<Venue> {
    return this.svc.setPublished(slug, false);
  }

  @Delete('venues/:slug')
  @HttpCode(204)
  async deleteVenue(@Param('slug') slug: string): Promise<void> {
    await this.svc.deleteVenue(slug);
  }

  @Post('venues/:slug/retry-images')
  retryImages(@Param('slug') slug: string): Promise<Venue> {
    return this.svc.retryFailedImages(slug);
  }
}
