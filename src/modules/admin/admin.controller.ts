import {
  Body,
  Controller,
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
import { User } from '../../database/entities';
import { ChangeRoleDto } from './dto/change-role.dto';
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
  ): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.role = dto.role;
    return this.users.save(user);
  }
}
