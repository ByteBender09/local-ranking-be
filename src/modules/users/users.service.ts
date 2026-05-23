import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserSocials } from '../../database/entities';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

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
      .orderBy('u.check_in_count', 'DESC')
      .limit(limit)
      .getMany();
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
    if (patch.bio !== undefined) user.bio = patch.bio.slice(0, 280);
    if (patch.bookingEnabled !== undefined) user.bookingEnabled = patch.bookingEnabled;
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
