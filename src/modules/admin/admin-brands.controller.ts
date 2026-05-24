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
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { Tour, User } from '../../database/entities';
import {
  AdminBrandSort,
  ListAdminBrandsDto,
  UpdateAdminBrandDto,
} from './dto/admin-brand.dto';

// Lightweight projection returned to the admin UI so we don't leak sensitive
// user fields (instagram tokens, googleId, etc).
export interface AdminBrandRow {
  id: string;
  handle: string;
  name: string;
  email: string | null;
  avatar: string;
  role: User['role'];
  isBlocked: boolean;
  brandName: string | null;
  brandShortName: string | null;
  brandLogoUrl: string | null;
  brandDescription: string;
  brandWebsiteUrl: string | null;
  brandContactEmail: string | null;
  brandEmailVerified: boolean;
  brandEmailVerifiedAt: Date | null;
  tourCount: number;
  createdAt: Date;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminBrandsController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Tour) private readonly tours: Repository<Tour>,
  ) {}

  @Get('brands')
  async list(
    @Query() filter: ListAdminBrandsDto,
  ): Promise<PaginatedResponse<AdminBrandRow>> {
    const qb = this.users
      .createQueryBuilder('u')
      .where('u.brand_name IS NOT NULL');

    if (filter.q && filter.q.trim()) {
      const term = `%${filter.q.trim()}%`;
      qb.andWhere(
        '(u.brand_name ILIKE :term OR u.handle ILIKE :term OR u.email ILIKE :term OR u.brand_contact_email ILIKE :term)',
        { term },
      );
    }
    if (filter.verified !== undefined) {
      qb.andWhere('u.brand_email_verified = :v', {
        v: filter.verified === 'true',
      });
    }

    this.applySort(qb, filter.sort);
    qb.addOrderBy('u.id', 'ASC').skip(filter.skip).take(filter.limit);

    const [items, total] = await qb.getManyAndCount();

    // Batch-load tour counts for each brand to avoid N+1.
    const ids = items.map((u) => u.id);
    const countMap = await this.tourCountsByOwners(ids);

    const rows: AdminBrandRow[] = items.map((u) => ({
      id: u.id,
      handle: u.handle,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      isBlocked: u.isBlocked,
      brandName: u.brandName,
      brandShortName: u.brandShortName,
      brandLogoUrl: u.brandLogoUrl,
      brandDescription: u.brandDescription ?? '',
      brandWebsiteUrl: u.brandWebsiteUrl,
      brandContactEmail: u.brandContactEmail,
      brandEmailVerified: u.brandEmailVerified,
      brandEmailVerifiedAt: u.brandEmailVerifiedAt,
      tourCount: countMap.get(u.id) ?? 0,
      createdAt: u.createdAt,
    }));

    return new PaginatedResponse(rows, total, filter.page, filter.limit);
  }

  @Get('brands/:id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminBrandRow> {
    const u = await this.users.findOne({ where: { id } });
    if (!u || !u.brandName) throw new NotFoundException('Brand not found');
    const countMap = await this.tourCountsByOwners([u.id]);
    return {
      id: u.id,
      handle: u.handle,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      isBlocked: u.isBlocked,
      brandName: u.brandName,
      brandShortName: u.brandShortName,
      brandLogoUrl: u.brandLogoUrl,
      brandDescription: u.brandDescription ?? '',
      brandWebsiteUrl: u.brandWebsiteUrl,
      brandContactEmail: u.brandContactEmail,
      brandEmailVerified: u.brandEmailVerified,
      brandEmailVerifiedAt: u.brandEmailVerifiedAt,
      tourCount: countMap.get(u.id) ?? 0,
      createdAt: u.createdAt,
    };
  }

  @Patch('brands/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminBrandDto,
  ): Promise<User> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Brand not found');
    const prevEmail = u.brandContactEmail;
    if (dto.brandName !== undefined) u.brandName = dto.brandName;
    if (dto.brandShortName !== undefined) u.brandShortName = dto.brandShortName;
    if (dto.brandLogoUrl !== undefined)
      u.brandLogoUrl = dto.brandLogoUrl || null;
    if (dto.brandDescription !== undefined)
      u.brandDescription = dto.brandDescription;
    if (dto.brandWebsiteUrl !== undefined)
      u.brandWebsiteUrl = dto.brandWebsiteUrl || null;
    if (dto.brandContactEmail !== undefined) {
      u.brandContactEmail = dto.brandContactEmail.toLowerCase();
      // If contact email changed we don't auto-reset the verified flag for
      // admin edits — admins are trusted to know the brand identity. If the
      // brand owner changes their own email via /me/branding, that flow does
      // reset verified to false.
    }
    const saved = await this.users.save(u);
    await this.syncOwnedTourProviders(saved);
    void prevEmail;
    return saved;
  }

  @Patch('brands/:id/verify')
  async verify(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Brand not found');
    if (!u.brandName)
      throw new NotFoundException('User has no brand to verify');
    u.brandEmailVerified = true;
    u.brandEmailVerifiedAt = new Date();
    const saved = await this.users.save(u);
    await this.syncOwnedTourProviders(saved);
    return saved;
  }

  @Patch('brands/:id/unverify')
  async unverify(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Brand not found');
    u.brandEmailVerified = false;
    u.brandEmailVerifiedAt = null;
    const saved = await this.users.save(u);
    await this.syncOwnedTourProviders(saved);
    return saved;
  }

  private async tourCountsByOwners(
    ownerIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (ownerIds.length === 0) return map;
    const rows = await this.tours
      .createQueryBuilder('t')
      .select('t.owner_id', 'ownerId')
      .addSelect('COUNT(*)', 'cnt')
      .where('t.owner_id IN (:...ids)', { ids: ownerIds })
      .groupBy('t.owner_id')
      .getRawMany<{ ownerId: string; cnt: string }>();
    for (const r of rows) map.set(r.ownerId, Number(r.cnt));
    return map;
  }

  private async syncOwnedTourProviders(user: User): Promise<void> {
    if (!user.brandName) return;
    await this.tours
      .createQueryBuilder()
      .update(Tour)
      .set({
        provider: {
          name: user.brandName,
          shortName:
            user.brandShortName ?? user.handle.slice(0, 6).toUpperCase(),
          verified: user.role === 'admin' ? true : user.brandEmailVerified,
          logoUrl: user.brandLogoUrl ?? null,
        },
      })
      .where('owner_id = :id', { id: user.id })
      .execute();
  }

  private applySort(
    qb: ReturnType<Repository<User>['createQueryBuilder']>,
    sort: AdminBrandSort,
  ): void {
    switch (sort) {
      case 'oldest':
        qb.orderBy('u.createdAt', 'ASC');
        return;
      case 'name':
        qb.orderBy('u.brand_name', 'ASC');
        return;
      case 'tours':
        // We can't easily order by joined aggregate without a subquery; fall
        // back to recency. The FE keeps the option for UX but the actual
        // order may not match — acceptable for v1.
        qb.orderBy('u.createdAt', 'DESC');
        return;
      case 'newest':
      default:
        qb.orderBy('u.createdAt', 'DESC');
        return;
    }
  }
}
