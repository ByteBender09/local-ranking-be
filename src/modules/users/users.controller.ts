import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../database/entities';
import { PublicUserDto } from './dto/public-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Public()
  @Get('leaderboard')
  async leaderboard(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<PublicUserDto[]> {
    const users = await this.users.leaderboard(Math.min(Math.max(limit, 1), 100));
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

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
  ): Promise<User> {
    return this.users.updateProfile(user.id, body);
  }

  @Public()
  @Get(':handle')
  async byHandle(@Param('handle') handle: string): Promise<PublicUserDto> {
    const user = await this.users.findByHandle(handle);
    return PublicUserDto.from(user);
  }
}
