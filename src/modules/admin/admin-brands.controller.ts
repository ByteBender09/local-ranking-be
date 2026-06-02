import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { Brand, Tour } from '../../database/entities';
import {
  AdminBrandSort,
  CreateAdminBrandDto,
  ListAdminBrandsDto,
  UpdateAdminBrandDto,
} from './dto/admin-brand.dto';

// Brand row + how many tours reference it.
export interface AdminBrandRow {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  description: string;
  websiteUrl: string | null;
  contactEmail: string | null;
  verified: boolean;
  verifiedAt: Date | null;
  tourCount: number;
  createdAt: Date;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminBrandsController {
  constructor(
    @InjectRepository(Brand) private readonly brands: Repository<Brand>,
    @InjectRepository(Tour) private readonly tours: Repository<Tour>,
  ) {}

  @Get('brands')
  async list(
    @Query() filter: ListAdminBrandsDto,
  ): Promise<PaginatedResponse<AdminBrandRow>> {
    const qb = this.brands.createQueryBuilder('b');

    if (filter.q && filter.q.trim()) {
      const term = `%${filter.q.trim()}%`;
      qb.andWhere(
        '(b.name ILIKE :term OR b.short_name ILIKE :term OR b.contact_email ILIKE :term)',
        { term },
      );
    }
    if (filter.verified !== undefined) {
      qb.andWhere('b.verified = :v', { v: filter.verified === 'true' });
    }

    this.applySort(qb, filter.sort);
    qb.addOrderBy('b.id', 'ASC').skip(filter.skip).take(filter.limit);

    const [items, total] = await qb.getManyAndCount();
    const countMap = await this.tourCountsByBrands(items.map((b) => b.id));
    const rows = items.map((b) => this.toRow(b, countMap.get(b.id) ?? 0));
    return new PaginatedResponse(rows, total, filter.page, filter.limit);
  }

  @Get('brands/:id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminBrandRow> {
    const b = await this.brands.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Brand not found');
    const countMap = await this.tourCountsByBrands([b.id]);
    return this.toRow(b, countMap.get(b.id) ?? 0);
  }

  @Post('brands')
  async create(@Body() dto: CreateAdminBrandDto): Promise<Brand> {
    const brand = this.brands.create({
      name: dto.name,
      shortName: dto.shortName,
      logoUrl: dto.logoUrl || null,
      description: dto.description ?? '',
      websiteUrl: dto.websiteUrl || null,
      contactEmail: dto.contactEmail ? dto.contactEmail.toLowerCase() : null,
      verified: false,
      verifiedAt: null,
    });
    return this.brands.save(brand);
  }

  @Patch('brands/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminBrandDto,
  ): Promise<Brand> {
    const b = await this.brands.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Brand not found');
    if (dto.name !== undefined) b.name = dto.name;
    if (dto.shortName !== undefined) b.shortName = dto.shortName;
    if (dto.logoUrl !== undefined) b.logoUrl = dto.logoUrl || null;
    if (dto.description !== undefined) b.description = dto.description;
    if (dto.websiteUrl !== undefined) b.websiteUrl = dto.websiteUrl || null;
    if (dto.contactEmail !== undefined)
      b.contactEmail = dto.contactEmail ? dto.contactEmail.toLowerCase() : null;
    const saved = await this.brands.save(b);
    await this.syncTourProviders(saved);
    return saved;
  }

  @Patch('brands/:id/verify')
  async verify(@Param('id', ParseUUIDPipe) id: string): Promise<Brand> {
    const b = await this.brands.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Brand not found');
    b.verified = true;
    b.verifiedAt = new Date();
    const saved = await this.brands.save(b);
    await this.syncTourProviders(saved);
    return saved;
  }

  @Patch('brands/:id/unverify')
  async unverify(@Param('id', ParseUUIDPipe) id: string): Promise<Brand> {
    const b = await this.brands.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Brand not found');
    b.verified = false;
    b.verifiedAt = null;
    const saved = await this.brands.save(b);
    await this.syncTourProviders(saved);
    return saved;
  }

  @Delete('brands/:id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const b = await this.brands.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Brand not found');
    // Tours keep existing but become system-managed: FK sets brand_id NULL;
    // re-stamp their denormalised provider to the site default so cards don't
    // show a deleted brand.
    await this.tours
      .createQueryBuilder()
      .update(Tour)
      .set({
        provider: {
          name: 'Hôm Nay Đi Đâu',
          shortName: 'HNDD',
          verified: true,
          logoUrl: null,
        },
      })
      .where('brand_id = :id', { id })
      .execute();
    await this.brands.delete({ id });
  }

  private toRow(b: Brand, tourCount: number): AdminBrandRow {
    return {
      id: b.id,
      name: b.name,
      shortName: b.shortName,
      logoUrl: b.logoUrl,
      description: b.description ?? '',
      websiteUrl: b.websiteUrl,
      contactEmail: b.contactEmail,
      verified: b.verified,
      verifiedAt: b.verifiedAt,
      tourCount,
      createdAt: b.createdAt,
    };
  }

  private async tourCountsByBrands(
    brandIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (brandIds.length === 0) return map;
    const rows = await this.tours
      .createQueryBuilder('t')
      .select('t.brand_id', 'brandId')
      .addSelect('COUNT(*)', 'cnt')
      .where('t.brand_id IN (:...ids)', { ids: brandIds })
      .groupBy('t.brand_id')
      .getRawMany<{ brandId: string; cnt: string }>();
    for (const r of rows) map.set(r.brandId, Number(r.cnt));
    return map;
  }

  // Re-stamp the denormalised provider JSON on every tour of this brand so
  // cards reflect the brand's current name/logo/verified state.
  private async syncTourProviders(brand: Brand): Promise<void> {
    await this.tours
      .createQueryBuilder()
      .update(Tour)
      .set({
        provider: {
          name: brand.name,
          shortName: brand.shortName,
          verified: brand.verified,
          logoUrl: brand.logoUrl ?? null,
        },
      })
      .where('brand_id = :id', { id: brand.id })
      .execute();
  }

  private applySort(
    qb: ReturnType<Repository<Brand>['createQueryBuilder']>,
    sort: AdminBrandSort,
  ): void {
    switch (sort) {
      case 'oldest':
        qb.orderBy('b.createdAt', 'ASC');
        return;
      case 'name':
        qb.orderBy('b.name', 'ASC');
        return;
      case 'tours':
        // Ordering by joined aggregate needs a subquery; fall back to recency.
        qb.orderBy('b.createdAt', 'DESC');
        return;
      case 'newest':
      default:
        qb.orderBy('b.createdAt', 'DESC');
        return;
    }
  }
}
