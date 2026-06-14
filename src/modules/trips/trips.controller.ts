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
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { PaginatedResponse, PaginationDto } from '../../common/dto/pagination.dto';
import { TripsService, TripMemoryDto } from './trips.service';
import {
  CreateTripDto,
  InviteMembersDto,
  RespondInviteDto,
  TransferOwnerDto,
  UpdateTripDto,
} from './dto/trip.dto';
import { TripDto } from './dto/trip-response.dto';

@Controller()
export class TripsController {
  constructor(private readonly service: TripsService) {}

  @Post('trips')
  async create(
    @Body() body: CreateTripDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto> {
    const trip = await this.service.create(user.id, body);
    return TripDto.from(trip, user.id);
  }

  @Get('me/trips')
  async myTrips(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto[]> {
    const trips = await this.service.listMine(user.id);
    return trips.map((t) => TripDto.from(t, user.id));
  }

  @Get('me/trip-invites')
  async myInvites(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto[]> {
    const trips = await this.service.listInvites(user.id);
    return trips.map((t) => TripDto.from(t, user.id));
  }

  @Get('trips/:id')
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto> {
    const trip = await this.service.getDetail(id, user.id);
    return TripDto.from(trip, user.id);
  }

  @Get('trips/:id/memories')
  memories(
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponse<TripMemoryDto>> {
    return this.service.listMemories(id, user.id, pagination);
  }

  @Patch('trips/:id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateTripDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto> {
    const trip = await this.service.update(id, user.id, body);
    return TripDto.from(trip, user.id);
  }

  @Delete('trips/:id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.remove(id, user.id);
  }

  @Post('trips/:id/invite')
  async invite(
    @Param('id') id: string,
    @Body() body: InviteMembersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto> {
    const trip = await this.service.invite(id, user.id, body);
    return TripDto.from(trip, user.id);
  }

  @Post('trips/:id/end')
  async end(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto> {
    const trip = await this.service.endTrip(id, user.id);
    return TripDto.from(trip, user.id);
  }

  @Post('trips/:id/leave')
  @HttpCode(204)
  async leave(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.leave(id, user.id);
  }

  @Post('trips/:id/invite/respond')
  async respondInvite(
    @Param('id') id: string,
    @Body() body: RespondInviteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto> {
    const trip = await this.service.respondInvite(id, user.id, body.accept);
    return TripDto.from(trip, user.id);
  }

  @Delete('trips/:id/members/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto> {
    const trip = await this.service.removeMember(id, user.id, userId);
    return TripDto.from(trip, user.id);
  }

  @Post('trips/:id/transfer-owner')
  async transferOwner(
    @Param('id') id: string,
    @Body() body: TransferOwnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TripDto> {
    const trip = await this.service.transferOwner(id, user.id, body.userId);
    return TripDto.from(trip, user.id);
  }
}
