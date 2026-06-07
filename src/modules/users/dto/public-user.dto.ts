import { User, UserRole, UserSocials } from '../../../database/entities';

export class PublicUserDto {
  id: string;
  handle: string;
  name: string;
  // User-chosen display override. UIs that surface a person publicly
  // (leaderboard, venue cards) should render `nickname || name`.
  nickname: string;
  avatar: string;
  bio: string;
  citySlug: string | null;
  checkInCount: number;
  followerCount: number;
  followingCount: number;
  role: UserRole;
  socials: UserSocials;
  bookingEnabled: boolean;
  bookingPriceVnd: number | null;
  brandName: string | null;
  brandShortName: string | null;
  brandLogoUrl: string | null;
  brandEmailVerified: boolean;

  static from(user: User): PublicUserDto {
    return {
      id: user.id,
      handle: user.handle,
      name: user.name,
      nickname: user.nickname ?? '',
      avatar: user.avatar,
      bio: user.bio,
      citySlug: user.citySlug,
      checkInCount: user.checkInCount,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      role: user.role,
      socials: user.socials,
      bookingEnabled: user.bookingEnabled,
      bookingPriceVnd: user.bookingPriceVnd,
      brandName: user.brandName,
      brandShortName: user.brandShortName,
      brandLogoUrl: user.brandLogoUrl,
      brandEmailVerified: user.brandEmailVerified,
    };
  }
}
