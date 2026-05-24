import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { User } from '../../database/entities';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ListAdminUsersDto, AdminUserSort } from './dto/list-admin-users.dto';
import { BlockUserDto } from './dto/block-user.dto';
import { AdminOverview, AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly admin: AdminService,
  ) {}

  @Get('overview')
  overview(): Promise<AdminOverview> {
    return this.admin.overview();
  }

  @Get('users')
  async list(
    @Query() filter: ListAdminUsersDto,
  ): Promise<PaginatedResponse<User>> {
    const qb = this.users.createQueryBuilder('u');

    if (filter.q && filter.q.trim()) {
      const term = `%${filter.q.trim()}%`;
      qb.andWhere(
        '(u.handle ILIKE :term OR u.name ILIKE :term OR u.email ILIKE :term)',
        { term },
      );
    }
    if (filter.role) qb.andWhere('u.role = :role', { role: filter.role });
    if (filter.isBlocked !== undefined) {
      qb.andWhere('u.is_blocked = :blocked', {
        blocked: filter.isBlocked === 'true',
      });
    }

    this.applySort(qb, filter.sort);
    qb.addOrderBy('u.id', 'ASC').skip(filter.skip).take(filter.limit);

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResponse(items, total, filter.page, filter.limit);
  }

  // Legacy: kept for places that still call /admin/users?q=... directly.
  // Returns the same paginated shape.
  @Get('users/search')
  search(@Query('q') q?: string): Promise<User[]> {
    if (!q) return this.users.find({ take: 50, order: { createdAt: 'DESC' } });
    const term = `%${q}%`;
    return this.users.find({
      where: [
        { handle: ILike(term) },
        { name: ILike(term) },
        { email: ILike(term) },
      ],
      take: 50,
    });
  }

  @Patch('users/:id/role')
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<User> {
    if (current.id === id && dto.role !== 'admin') {
      throw new ForbiddenException('Không thể tự hạ quyền admin của chính mình');
    }
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.role = dto.role;
    return this.users.save(user);
  }

  @Patch('users/:id/block')
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockUserDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<User> {
    if (current.id === id)
      throw new ForbiddenException('Không thể tự khóa tài khoản của mình');
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin')
      throw new BadRequestException(
        'Hãy hạ quyền admin trước khi khóa tài khoản này',
      );
    user.isBlocked = true;
    user.blockedAt = new Date();
    user.blockedReason = dto.reason ?? null;
    return this.users.save(user);
  }

  @Patch('users/:id/unblock')
  async unblock(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.isBlocked = false;
    user.blockedAt = null;
    user.blockedReason = null;
    return this.users.save(user);
  }

  private applySort(
    qb: ReturnType<Repository<User>['createQueryBuilder']>,
    sort: AdminUserSort,
  ): void {
    switch (sort) {
      case 'oldest':
        qb.orderBy('u.createdAt', 'ASC');
        return;
      case 'name':
        qb.orderBy('u.name', 'ASC');
        return;
      case 'handle':
        qb.orderBy('u.handle', 'ASC');
        return;
      case 'newest':
      default:
        qb.orderBy('u.createdAt', 'DESC');
        return;
    }
  }
}
