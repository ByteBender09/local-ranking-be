import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CheckIn, User } from '../../database/entities';
import { PublicUserDto } from './dto/public-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import { CheckInsService } from '../check-ins/check-ins.service';

export type PublicUserWithFollow = PublicUserDto & { isFollowing: boolean };

function dtoWithFollow(user: User, isFollowing: boolean): PublicUserWithFollow {
  return { ...PublicUserDto.from(user), isFollowing };
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly checkIns: CheckInsService,
  ) {}

  @Public()
  @Get('leaderboard')
  async leaderboard(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<PublicUserDto[]> {
    const users = await this.users.leaderboard(
      Math.min(Math.max(limit, 1), 100),
    );
    return users.map(PublicUserDto.from);
  }

  @Public()
  @Get('bookable')
  async bookable(
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ): Promise<PublicUserDto[]> {
    const users = await this.users.bookable(Math.min(Math.max(limit, 1), 50));
    return users.map(PublicUserDto.from);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<User> {
    const result = await this.users.findById(user.id);
    if (!result) throw new Error('Auth user vanished');
    return result;
  }

  // Global leaderboard position for the authenticated user. Returns
  //   { rank, total }
  // where rank is 1-indexed (1 = top of board) and total counts users
  // with > 0 check-ins (real participants only). Used by the profile
  // page's "Hạng #X / N" tile.
  @UseGuards(JwtAuthGuard)
  @Get('me/rank')
  myRank(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ rank: number; total: number }> {
    return this.users.getMyRank(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
  ): Promise<User> {
    return this.users.updateProfile(user.id, body);
  }

  // Global user search for the @-mention dropdown. Auth optional — when
  // signed-in the caller is excluded from results and each row is
  // annotated with `isFollowing`. Capped at 25.
  // @Public bypasses the global JwtAuthGuard; OptionalJwtAuthGuard then
  // populates req.user if a token IS present.
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('search')
  async search(
    @CurrentUser() viewer: AuthenticatedUser | undefined,
    @Query('q') q: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PublicUserWithFollow[]> {
    const users = await this.users.searchUsers(q ?? '', {
      limit,
      excludeId: viewer?.id,
    });
    const annotated = await this.users.annotateFollowing(viewer?.id, users);
    return annotated.map(({ user, isFollowing }) =>
      dtoWithFollow(user, isFollowing),
    );
  }

  // The viewer's most-recent followers. Drives the INITIAL list shown when
  // a user opens the @-mention dropdown (Facebook-style: friends first,
  // search globally after).
  @UseGuards(JwtAuthGuard)
  @Get('me/followers/recent')
  async myRecentFollowers(
    @CurrentUser() viewer: AuthenticatedUser,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PublicUserDto[]> {
    const users = await this.users.myRecentFollowers(viewer.id, limit);
    return users.map((u) => PublicUserDto.from(u));
  }

  // Public profile lookup with viewer-aware isFollowing flag. Replaces the
  // bare `byHandle` for clients that need to render a Follow button.
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':handle')
  async byHandle(
    @CurrentUser() viewer: AuthenticatedUser | undefined,
    @Param('handle') handle: string,
  ): Promise<PublicUserWithFollow> {
    const user = await this.users.findByHandle(handle);
    const isFollowing = viewer
      ? await this.users.isFollowing(viewer.id, user.id)
      : false;
    return dtoWithFollow(user, isFollowing);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':handle/follow')
  @HttpCode(204)
  async followUser(
    @CurrentUser() viewer: AuthenticatedUser,
    @Param('handle') handle: string,
  ): Promise<void> {
    await this.users.follow(viewer.id, handle);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':handle/follow')
  @HttpCode(204)
  async unfollowUser(
    @CurrentUser() viewer: AuthenticatedUser,
    @Param('handle') handle: string,
  ): Promise<void> {
    await this.users.unfollow(viewer.id, handle);
  }

  // Followers of :handle. Public list with viewer-aware isFollowing per row.
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':handle/followers')
  async listFollowers(
    @CurrentUser() viewer: AuthenticatedUser | undefined,
    @Param('handle') handle: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('q') q?: string,
  ): Promise<{
    data: PublicUserWithFollow[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safePage = Math.max(page, 1);
    const { items, total } = await this.users.listFollowers(handle, {
      page: safePage,
      limit: safeLimit,
      q,
      viewerId: viewer?.id,
    });
    return {
      data: items.map((i) => dtoWithFollow(i.user, i.isFollowing)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':handle/following')
  async listFollowing(
    @CurrentUser() viewer: AuthenticatedUser | undefined,
    @Param('handle') handle: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('q') q?: string,
  ): Promise<{
    data: PublicUserWithFollow[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safePage = Math.max(page, 1);
    const { items, total } = await this.users.listFollowing(handle, {
      page: safePage,
      limit: safeLimit,
      q,
      viewerId: viewer?.id,
    });
    return {
      data: items.map((i) => dtoWithFollow(i.user, i.isFollowing)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  // PUBLIC check-ins of :handle. Filters is_public = true so private
  // memories never leak when someone else views the profile. Includes
  // venue + city so the FE can render the same memory card shape used
  // in the journey timeline.
  @Public()
  @Get(':handle/check-ins')
  async publicCheckIns(
    @Param('handle') handle: string,
  ): Promise<CheckIn[]> {
    const user = await this.users.findByHandle(handle);
    return this.checkIns.listPublicByUser(user.id);
  }
}
