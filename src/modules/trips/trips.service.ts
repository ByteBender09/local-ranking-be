import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  CheckIn,
  Trip,
  TripDestination,
  TripMember,
  User,
  UserFollow,
} from '../../database/entities';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { PublicUserDto } from '../users/dto/public-user.dto';
import {
  CreateTripDto,
  InviteMembersDto,
  UpdateTripDto,
} from './dto/trip.dto';

// A memory as exposed in the shared trip feed: the check-in row with its
// author reduced to public-safe fields (same contract as the /m/[id] route).
export type TripMemoryDto = Omit<CheckIn, 'user'> & { user: PublicUserDto };

@Injectable()
export class TripsService {
  constructor(private readonly dataSource: DataSource) {}

  private get trips() {
    return this.dataSource.getRepository(Trip);
  }
  private get members() {
    return this.dataSource.getRepository(TripMember);
  }

  // ---- Reads -------------------------------------------------------------

  // Trips the user owns or has joined. Includes destinations + members (for
  // avatars) so the list renders without N+1 follow-ups.
  async listMine(userId: string): Promise<Trip[]> {
    const ids = await this.members
      .createQueryBuilder('m')
      .select('m.trip_id', 'tripId')
      .where('m.user_id = :userId', { userId })
      .andWhere('m.status = :status', { status: 'joined' })
      .getRawMany<{ tripId: string }>();
    const tripIds = ids.map((r) => r.tripId);
    if (tripIds.length === 0) return [];

    return this.trips.find({
      where: { id: In(tripIds) },
      relations: {
        destinations: { city: true },
        members: { user: true },
      },
      order: { startDate: 'DESC' },
    });
  }

  // Pending invites for the badge/list on the trip screen.
  async listInvites(userId: string): Promise<Trip[]> {
    const rows = await this.members.find({
      where: { userId, status: 'invited' },
      select: { tripId: true },
    });
    const tripIds = rows.map((r) => r.tripId);
    if (tripIds.length === 0) return [];
    return this.trips.find({
      where: { id: In(tripIds) },
      relations: {
        destinations: { city: true },
        members: { user: true },
        owner: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getDetail(tripId: string, viewerId?: string): Promise<Trip> {
    const trip = await this.loadFull(tripId);
    await this.assertCanView(trip, viewerId);
    return trip;
  }

  // The core shared feed: every joined member's PUBLIC check-in whose
  // createdAt falls within the trip window. Memberships are derived here —
  // nothing is stamped on the check-in rows. Uses idx_checkins_user_created.
  async listMemories(
    tripId: string,
    viewerId: string | undefined,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<TripMemoryDto>> {
    const trip = await this.loadFull(tripId);
    await this.assertCanView(trip, viewerId);

    // Include members who have LEFT as well as joined ones: leaving must not
    // erase the memories a person already contributed to the trip.
    const memberIds = (trip.members ?? [])
      .filter((m) => m.status === 'joined' || m.status === 'left')
      .map((m) => m.userId);
    if (memberIds.length === 0) {
      return new PaginatedResponse<TripMemoryDto>(
        [],
        0,
        pagination.page,
        pagination.limit,
      );
    }

    // Upper bound of the memory window. If the owner ended the trip early,
    // `endedAt` is a precise instant and the window closes immediately. Otherwise
    // we include the whole end day regardless of the stored time component (and
    // timezone-agnostic): everything up to start-of-day(end) + 24h.
    const endNext =
      trip.endedAt ?? new Date(trip.endDate.getTime() + 24 * 60 * 60 * 1000);

    const repo = this.dataSource.getRepository(CheckIn);
    // Shared filters. Reference columns by ENTITY PROPERTY (camelCase) so
    // TypeORM maps them correctly.
    const applyConds = (qb: ReturnType<typeof repo.createQueryBuilder>) =>
      qb
        .where('ci.userId IN (:...memberIds)', { memberIds })
        .andWhere('ci.isPublic = :pub', { pub: true })
        .andWhere('ci.createdAt >= :start', { start: trip.startDate })
        .andWhere('ci.createdAt < :endNext', { endNext });

    const total = await applyConds(repo.createQueryBuilder('ci')).getCount();

    // Use raw limit/offset (not skip/take) so TypeORM does NOT switch to its
    // DISTINCT-id pagination path — that path + a join + orderBy throws on
    // Postgres ("ORDER BY must appear in SELECT DISTINCT list"). All joins
    // here are to-one, so a plain LIMIT returns the right rows.
    const rows = await applyConds(
      repo
        .createQueryBuilder('ci')
        .leftJoinAndSelect('ci.venue', 'venue')
        .leftJoinAndSelect('venue.city', 'city')
        .leftJoinAndSelect('ci.user', 'user'),
    )
      .orderBy('ci.createdAt', 'ASC')
      .limit(pagination.limit)
      .offset(pagination.skip)
      .getMany();

    const data: TripMemoryDto[] = rows
      .filter((ci) => ci.user != null) // guard: never map a missing author
      .map((ci) => {
        const { user, ...rest } = ci;
        return { ...rest, user: PublicUserDto.from(user) };
      });
    return new PaginatedResponse<TripMemoryDto>(
      data,
      total,
      pagination.page,
      pagination.limit,
    );
  }

  // ---- Mutations ---------------------------------------------------------

  async create(userId: string, dto: CreateTripDto): Promise<Trip> {
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    const tripId = await this.dataSource.transaction(async (manager) => {
      const trip = await manager.save(
        manager.create(Trip, {
          ownerId: userId,
          title: dto.title,
          coverImage: dto.coverImage ?? null,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          visibility: dto.visibility ?? 'followers',
        }),
      );

      await this.replaceDestinations(manager, trip.id, dto.destinationCityIds);

      // Owner is a joined member from the start.
      await manager.save(
        manager.create(TripMember, {
          tripId: trip.id,
          userId,
          role: 'owner',
          status: 'joined',
          joinedAt: new Date(),
        }),
      );
      return trip.id;
    });
    return this.loadFull(tripId);
  }

  async update(
    tripId: string,
    userId: string,
    dto: UpdateTripDto,
  ): Promise<Trip> {
    await this.dataSource.transaction(async (manager) => {
      const trip = await manager.findOne(Trip, { where: { id: tripId } });
      if (!trip) throw new NotFoundException('Trip not found');
      this.assertOwner(trip, userId);

      if (dto.title !== undefined) trip.title = dto.title;
      if (dto.coverImage !== undefined) trip.coverImage = dto.coverImage;
      if (dto.visibility !== undefined) trip.visibility = dto.visibility;
      if (dto.startDate !== undefined) trip.startDate = new Date(dto.startDate);
      if (dto.endDate !== undefined) trip.endDate = new Date(dto.endDate);
      if (trip.endDate < trip.startDate) {
        throw new BadRequestException('endDate must be on or after startDate');
      }
      await manager.save(trip);

      if (dto.destinationCityIds !== undefined) {
        await this.replaceDestinations(
          manager,
          tripId,
          dto.destinationCityIds,
        );
      }
    });
    return this.loadFull(tripId);
  }

  async remove(tripId: string, userId: string): Promise<void> {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) return; // idempotent
    this.assertOwner(trip, userId);
    await this.trips.softDelete({ id: tripId });
  }

  // The owner ends the trip early. Stamps `endedAt = now`, which freezes the
  // memory window (no new check-ins are collected) and flips the app to the
  // read-only ended-album view. Idempotent — a no-op if already ended.
  async endTrip(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    this.assertOwner(trip, userId);
    if (!trip.endedAt) {
      trip.endedAt = new Date();
      await this.trips.save(trip);
    }
    return this.loadFull(tripId);
  }

  async invite(
    tripId: string,
    ownerId: string,
    dto: InviteMembersDto,
  ): Promise<Trip> {
    await this.dataSource.transaction(async (manager) => {
      const trip = await manager.findOne(Trip, { where: { id: tripId } });
      if (!trip) throw new NotFoundException('Trip not found');
      this.assertOwner(trip, ownerId);

      // Only invite real users; silently ignore unknown ids.
      const users = await manager.find(User, {
        where: { id: In(dto.userIds) },
        select: { id: true },
      });
      for (const u of users) {
        if (u.id === ownerId) continue;
        const existing = await manager.findOne(TripMember, {
          where: { tripId, userId: u.id },
        });
        if (existing) {
          // Re-invite a declined member; leave joined members untouched.
          if (existing.status === 'declined') {
            existing.status = 'invited';
            existing.invitedById = ownerId;
            await manager.save(existing);
          }
          continue;
        }
        await manager.save(
          manager.create(TripMember, {
            tripId,
            userId: u.id,
            role: 'member',
            status: 'invited',
            invitedById: ownerId,
          }),
        );
      }
    });
    return this.loadFull(tripId);
  }

  async respondInvite(
    tripId: string,
    userId: string,
    accept: boolean,
  ): Promise<Trip> {
    const member = await this.members.findOne({ where: { tripId, userId } });
    if (!member || member.status !== 'invited') {
      throw new NotFoundException('No pending invite for this trip');
    }
    member.status = accept ? 'joined' : 'declined';
    member.joinedAt = accept ? new Date() : null;
    await this.members.save(member);
    return this.loadFull(tripId);
  }

  // A member leaves the trip from their own side. The trip vanishes from their
  // /me/trips, but their past memories stay in the feed for everyone else (the
  // row is kept with status 'left', not deleted). The owner can't leave — they
  // must transfer ownership or delete the trip.
  async leave(tripId: string, userId: string): Promise<void> {
    const member = await this.members.findOne({ where: { tripId, userId } });
    if (!member) return; // idempotent — not a member
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (trip && trip.ownerId === userId) {
      throw new BadRequestException(
        'Chủ phòng không thể rời. Hãy chuyển quyền hoặc xóa hành trình.',
      );
    }
    member.status = 'left';
    await this.members.save(member);
  }

  async removeMember(
    tripId: string,
    ownerId: string,
    targetUserId: string,
  ): Promise<Trip> {
    await this.dataSource.transaction(async (manager) => {
      const trip = await manager.findOne(Trip, { where: { id: tripId } });
      if (!trip) throw new NotFoundException('Trip not found');
      this.assertOwner(trip, ownerId);
      if (targetUserId === trip.ownerId) {
        throw new BadRequestException(
          'Transfer ownership before removing the owner',
        );
      }
      await manager.delete(TripMember, { tripId, userId: targetUserId });
    });
    return this.loadFull(tripId);
  }

  async transferOwner(
    tripId: string,
    ownerId: string,
    targetUserId: string,
  ): Promise<Trip> {
    await this.dataSource.transaction(async (manager) => {
      const trip = await manager.findOne(Trip, { where: { id: tripId } });
      if (!trip) throw new NotFoundException('Trip not found');
      this.assertOwner(trip, ownerId);
      if (targetUserId === ownerId) return; // no-op

      const target = await manager.findOne(TripMember, {
        where: { tripId, userId: targetUserId },
      });
      if (!target || target.status !== 'joined') {
        throw new BadRequestException('Target must be a joined member');
      }
      const current = await manager.findOne(TripMember, {
        where: { tripId, userId: ownerId },
      });

      target.role = 'owner';
      if (current) current.role = 'member';
      trip.ownerId = targetUserId;

      await manager.save([target, ...(current ? [current] : [])]);
      await manager.save(trip);
    });
    return this.loadFull(tripId);
  }

  // ---- Helpers -----------------------------------------------------------

  private async loadFull(tripId: string): Promise<Trip> {
    const trip = await this.trips.findOne({
      where: { id: tripId },
      relations: {
        destinations: { city: true },
        members: { user: true },
        owner: true,
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  private assertOwner(trip: Trip, userId: string): void {
    if (trip.ownerId !== userId) {
      throw new ForbiddenException('Only the trip owner can do this');
    }
  }

  // Visibility gate. Members (any non-declined status) and the owner always
  // see the trip. Otherwise it falls back to the trip's visibility setting.
  // Denials throw NotFound so a trip's existence never leaks (mirrors the
  // check-in memory route).
  private async assertCanView(trip: Trip, viewerId?: string): Promise<void> {
    if (viewerId) {
      const member = (trip.members ?? []).find((m) => m.userId === viewerId);
      // Active members (invited/joined) always see it; declined/left fall back
      // to the trip's visibility setting.
      if (member &&
          (member.status === 'invited' || member.status === 'joined')) {
        return;
      }
      if (trip.ownerId === viewerId) return;
    }
    if (trip.visibility === 'public') return;
    if (trip.visibility === 'followers' && viewerId) {
      const follows = await this.dataSource.getRepository(UserFollow).findOne({
        where: { followerId: viewerId, followingId: trip.ownerId },
      });
      if (follows) return;
    }
    throw new NotFoundException('Trip not found');
  }

  // Replace a trip's destination list with the given ordered city ids.
  private async replaceDestinations(
    manager: import('typeorm').EntityManager,
    tripId: string,
    cityIds: string[],
  ): Promise<void> {
    await manager.delete(TripDestination, { tripId });
    if (cityIds.length === 0) return;
    const rows = cityIds.map((cityId, i) =>
      manager.create(TripDestination, { tripId, cityId, sortOrder: i }),
    );
    await manager.save(rows);
  }
}
