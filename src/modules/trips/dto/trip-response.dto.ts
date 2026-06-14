import {
  Trip,
  TripDestination,
  TripMember,
  TripMemberRole,
  TripMemberStatus,
  TripVisibility,
} from '../../../database/entities';
import { PublicUserDto } from '../../users/dto/public-user.dto';

// City subset surfaced on a trip destination — enough to render the chip and
// drop a pin without leaking unrelated columns.
export class TripDestinationDto {
  id: string;
  cityId: string;
  sortOrder: number;
  slug: string;
  name: string;
  nameEn: string;
  coverImage: string;
  lat: number | null;
  lng: number | null;

  static from(d: TripDestination): TripDestinationDto {
    return {
      id: d.id,
      cityId: d.cityId,
      sortOrder: d.sortOrder,
      slug: d.city?.slug ?? '',
      name: d.city?.name ?? '',
      nameEn: d.city?.nameEn ?? '',
      coverImage: d.city?.coverImage ?? '',
      lat: d.city?.lat ?? null,
      lng: d.city?.lng ?? null,
    };
  }
}

export class TripMemberDto {
  id: string;
  userId: string;
  role: TripMemberRole;
  status: TripMemberStatus;
  joinedAt: Date | null;
  user: PublicUserDto | null;

  static from(m: TripMember): TripMemberDto {
    return {
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      user: m.user ? PublicUserDto.from(m.user) : null,
    };
  }
}

export class TripDto {
  id: string;
  ownerId: string;
  title: string;
  coverImage: string | null;
  startDate: Date;
  endDate: Date;
  endedAt: Date | null;
  visibility: TripVisibility;
  destinations: TripDestinationDto[];
  members: TripMemberDto[];
  memberCount: number; // joined members only
  createdAt: Date;
  updatedAt: Date;

  // Relationship of the requesting viewer to this trip, when known. Lets the
  // app decide which controls to show (owner actions, accept/decline invite).
  viewerRole: TripMemberRole | null;
  viewerStatus: TripMemberStatus | null;

  static from(trip: Trip, viewerId?: string): TripDto {
    const destinations = (trip.destinations ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(TripDestinationDto.from);

    const members = (trip.members ?? []).map(TripMemberDto.from);
    const viewer = viewerId
      ? (trip.members ?? []).find((m) => m.userId === viewerId)
      : undefined;

    return {
      id: trip.id,
      ownerId: trip.ownerId,
      title: trip.title,
      coverImage: trip.coverImage,
      startDate: trip.startDate,
      endDate: trip.endDate,
      endedAt: trip.endedAt ?? null,
      visibility: trip.visibility,
      destinations,
      members,
      memberCount: members.filter((m) => m.status === 'joined').length,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      viewerRole: viewer?.role ?? null,
      viewerStatus: viewer?.status ?? null,
    };
  }
}
