import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserSocials } from '../../database/entities';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async findByHandle(handle: string): Promise<User> {
    const user = await this.users.findOne({ where: { handle } });
    if (!user) throw new NotFoundException(`User not found: ${handle}`);
    return user;
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  leaderboard(limit: number): Promise<User[]> {
    return this.users
      .createQueryBuilder('u')
      .where('u.is_synthetic = false')
      .orderBy('u.check_in_count', 'DESC')
      .addOrderBy('u.id', 'ASC')
      .limit(limit)
      .getMany();
  }

  // Position the user holds in the global leaderboard, matching the
  // ordering of the leaderboard query (check_in_count DESC, id ASC for
  // a stable tie-break). total = all real (non-synthetic) users so the
  // "Hạng X / Y" denominator never exceeds the rank value.
  async getMyRank(userId: string): Promise<{ rank: number; total: number }> {
    const totalRaw = await this.users
      .createQueryBuilder('u')
      .where('u.is_synthetic = false')
      .getCount();
    if (totalRaw === 0) return { rank: 0, total: 0 };

    const rows = await this.users.query<{ rank: string }[]>(
      `WITH ranked AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY check_in_count DESC, id ASC) AS rank
         FROM users WHERE is_synthetic = false
       )
       SELECT rank FROM ranked WHERE id = $1`,
      [userId],
    );
    if (rows.length === 0) return { rank: 0, total: totalRaw };
    return { rank: parseInt(rows[0].rank, 10), total: totalRaw };
  }

  bookable(limit: number): Promise<User[]> {
    return this.users
      .createQueryBuilder('u')
      .where('u.booking_enabled = true')
      .orderBy('u.follower_count', 'DESC')
      .limit(limit)
      .getMany();
  }

  async updateProfile(id: string, patch: UpdateProfileDto): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id } });

    if (patch.name !== undefined) user.name = patch.name.slice(0, 40);
    if (patch.nickname !== undefined) user.nickname = patch.nickname.trim().slice(0, 40);
    if (patch.bio !== undefined) user.bio = patch.bio.slice(0, 280);
    if (patch.bookingEnabled !== undefined)
      user.bookingEnabled = patch.bookingEnabled;
    if (patch.bookingPriceVnd !== undefined)
      user.bookingPriceVnd = Math.max(0, Math.round(patch.bookingPriceVnd));
    if (patch.citySlug !== undefined) user.citySlug = patch.citySlug || null;

    if (patch.socials) {
      const clean: UserSocials = { ...(user.socials ?? {}) };
      for (const [k, raw] of Object.entries(patch.socials)) {
        const v = (raw ?? '').toString().trim().replace(/^@/, '');
        if (v.length === 0) delete clean[k as keyof UserSocials];
        else clean[k as keyof UserSocials] = v;
      }
      user.socials = clean;
    }

    return this.users.save(user);
  }
}
