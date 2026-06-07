import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User, UserFollow, UserSocials } from '../../database/entities';
import { UpdateProfileDto } from './dto/update-profile.dto';

export type FollowListItem = {
  user: User;
  followedAt: Date;
  isFollowing: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserFollow)
    private readonly follows: Repository<UserFollow>,
    private readonly dataSource: DataSource,
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
    if (patch.nickname !== undefined)
      user.nickname = patch.nickname.trim().slice(0, 40);
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

  // ── Follow graph ─────────────────────────────────────────────────────
  // follower follows following. (follower_id, following_id) is unique; the
  // denormalised users.follower_count is incremented/decremented in the
  // same transaction. Self-follow is blocked by a CHECK constraint AND
  // here to give a clear 400 instead of a 500.

  async follow(followerId: string, targetHandle: string): Promise<void> {
    const target = await this.users.findOne({
      where: { handle: targetHandle },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === followerId)
      throw new BadRequestException('Cannot follow yourself');

    await this.dataSource.transaction(async (mgr) => {
      try {
        await mgr.insert(UserFollow, {
          followerId,
          followingId: target.id,
        });
      } catch (e) {
        // Unique-violation — already following. Idempotent: swallow and
        // skip the count bump so we don't double-count.
        const code = (e as { code?: string })?.code;
        if (code === '23505') throw new ConflictException('Already following');
        throw e;
      }
      await mgr.increment(User, { id: target.id }, 'followerCount', 1);
    });
  }

  async unfollow(followerId: string, targetHandle: string): Promise<void> {
    const target = await this.users.findOne({
      where: { handle: targetHandle },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === followerId) return;

    await this.dataSource.transaction(async (mgr) => {
      const res = await mgr.delete(UserFollow, {
        followerId,
        followingId: target.id,
      });
      // Only decrement when a row actually existed — keeps the counter
      // honest across double-clicks / replayed requests.
      if ((res.affected ?? 0) > 0) {
        await mgr.decrement(User, { id: target.id }, 'followerCount', 1);
      }
    });
  }

  // True iff viewerId follows targetId. Used to colour the Follow button.
  async isFollowing(viewerId: string, targetId: string): Promise<boolean> {
    if (viewerId === targetId) return false;
    const row = await this.follows.findOne({
      where: { followerId: viewerId, followingId: targetId },
      select: { id: true },
    });
    return !!row;
  }

  // Bulk variant for lists — returns a Set of targetIds the viewer follows.
  async followStatusMap(
    viewerId: string,
    targetIds: string[],
  ): Promise<Set<string>> {
    if (!viewerId || targetIds.length === 0) return new Set();
    const rows = await this.follows.find({
      where: { followerId: viewerId, followingId: In(targetIds) },
      select: { followingId: true },
    });
    return new Set(rows.map((r) => r.followingId));
  }

  // Followers of `targetHandle`. Page is 1-indexed. `q` substring-matches
  // name / nickname / handle (case-insensitive). When `viewerId` is set,
  // each row is annotated with isFollowing so the FE can render the
  // right CTA per row.
  async listFollowers(
    targetHandle: string,
    opts: { page: number; limit: number; q?: string; viewerId?: string },
  ): Promise<{ items: FollowListItem[]; total: number }> {
    const target = await this.users.findOne({
      where: { handle: targetHandle },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');
    return this.listEdges('followers', target.id, opts);
  }

  async listFollowing(
    sourceHandle: string,
    opts: { page: number; limit: number; q?: string; viewerId?: string },
  ): Promise<{ items: FollowListItem[]; total: number }> {
    const source = await this.users.findOne({
      where: { handle: sourceHandle },
      select: { id: true },
    });
    if (!source) throw new NotFoundException('User not found');
    return this.listEdges('following', source.id, opts);
  }

  private async listEdges(
    side: 'followers' | 'following',
    pivotId: string,
    opts: { page: number; limit: number; q?: string; viewerId?: string },
  ): Promise<{ items: FollowListItem[]; total: number }> {
    // side=followers → other user is "follower_id", pivot is following_id
    // side=following → other user is "following_id", pivot is follower_id
    const otherCol = side === 'followers' ? 'follower_id' : 'following_id';
    const pivotCol = side === 'followers' ? 'following_id' : 'follower_id';

    const qb = this.dataSource
      .createQueryBuilder()
      .from('user_follows', 'f')
      .innerJoin(User, 'u', `u.id = f.${otherCol}`)
      .where(`f.${pivotCol} = :pivotId`, { pivotId })
      .andWhere('u.is_synthetic = false');

    const q = opts.q?.trim();
    if (q) {
      qb.andWhere(
        '(u.handle ILIKE :q OR u.name ILIKE :q OR u.nickname ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    const total = await qb.clone().getCount();
    const rows = await qb
      .select('u.id', 'id')
      .addSelect('f.created_at', 'followedAt')
      .orderBy('f.created_at', 'DESC')
      .offset((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .getRawMany<{ id: string; followedAt: Date }>();

    if (rows.length === 0) return { items: [], total };

    const ids = rows.map((r) => r.id);
    const users = await this.users.find({ where: { id: In(ids) } });
    const byId = new Map(users.map((u) => [u.id, u]));

    const followingSet = opts.viewerId
      ? await this.followStatusMap(opts.viewerId, ids)
      : new Set<string>();

    const items: FollowListItem[] = rows
      .map((r) => {
        const u = byId.get(r.id);
        if (!u) return null;
        return {
          user: u,
          followedAt: r.followedAt,
          isFollowing: followingSet.has(u.id),
        };
      })
      .filter((x): x is FollowListItem => x !== null);
    return { items, total };
  }

  // Global user search for the @-mention dropdown. Matches handle / name /
  // nickname (case-insensitive, prefix-friendly), excludes synthetic accounts
  // and the caller themselves. Ordered by follower_count DESC so prominent
  // users surface first; ties broken by handle for stability.
  async searchUsers(
    q: string,
    opts: { limit: number; excludeId?: string },
  ): Promise<User[]> {
    const needle = q.trim();
    if (needle.length === 0) return [];
    const qb = this.users
      .createQueryBuilder('u')
      .where('u.is_synthetic = false')
      .andWhere(
        '(u.handle ILIKE :q OR u.name ILIKE :q OR u.nickname ILIKE :q)',
        { q: `%${needle}%` },
      );
    if (opts.excludeId) {
      qb.andWhere('u.id <> :exc', { exc: opts.excludeId });
    }
    return qb
      .orderBy('u.follower_count', 'DESC')
      .addOrderBy('u.handle', 'ASC')
      .limit(Math.min(Math.max(opts.limit, 1), 25))
      .getMany();
  }

  // Returns the viewer's followers, ordered by most recent first. Used as
  // the INITIAL dropdown list when a user types `@` before typing anything
  // else — matches the Facebook UX where you see friends first, then can
  // search globally.
  async myRecentFollowers(viewerId: string, limit: number): Promise<User[]> {
    return this.listEdges('followers', viewerId, {
      page: 1,
      limit: Math.min(Math.max(limit, 1), 25),
    }).then((r) => r.items.map((i) => i.user));
  }

  // Helper for any endpoint that needs to project a list of users alongside
  // "is the viewer following them?" — used by the @-mention dropdown so the
  // FE can render a small badge.
  async annotateFollowing(
    viewerId: string | undefined,
    users: User[],
  ): Promise<{ user: User; isFollowing: boolean }[]> {
    if (!viewerId) return users.map((u) => ({ user: u, isFollowing: false }));
    const set = await this.followStatusMap(
      viewerId,
      users.map((u) => u.id),
    );
    return users.map((u) => ({ user: u, isFollowing: set.has(u.id) }));
  }

  // Used by leaderboard / profile-rank queries that already loaded a User
  // row but want to enrich with isFollowing for the current viewer.
  async followingFlag(viewerId: string | undefined, targetId: string) {
    if (!viewerId) return false;
    return this.isFollowing(viewerId, targetId);
  }
}
