import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  AdminTourSort,
  ListAdminToursDto,
} from './dto/list-admin-tours.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminToursController {
  constructor(
    @InjectRepository(Tour) private readonly tours: Repository<Tour>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get('tours')
  async list(
    @Query() filter: ListAdminToursDto,
  ): Promise<PaginatedResponse<Tour>> {
    const qb = this.tours
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.city', 'city')
      .leftJoinAndSelect('t.brand', 'brand');

    if (filter.citySlug)
      qb.andWhere('city.slug = :slug', { slug: filter.citySlug });
    if (filter.isPublished !== undefined)
      qb.andWhere('t.is_published = :p', {
        p: filter.isPublished === 'true',
      });
    if (filter.verified !== undefined) {
      qb.andWhere(`(t.provider->>'verified')::boolean = :v`, {
        v: filter.verified === 'true',
      });
    }
    if (filter.q && filter.q.trim()) {
      const term = `%${filter.q.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(t.title) LIKE :term OR LOWER(t.slug) LIKE :term OR LOWER(t.provider->>'name') LIKE :term)`,
        { term },
      );
    }

    this.applySort(qb, filter.sort);
    qb.addOrderBy('t.id', 'ASC').skip(filter.skip).take(filter.limit);

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResponse(items, total, filter.page, filter.limit);
  }

  // NOTE: per-tour verify endpoints were removed — verified state now lives
  // on the brand (User.brandEmailVerified) and is propagated to every tour
  // by the brand admin endpoints (/admin/brands/:id/verify). Tours are no
  // longer individually verified.

  @Patch('tours/:id/publish')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<Tour> {
    return this.setPublished(id, true);
  }

  @Patch('tours/:id/unpublish')
  async unpublish(@Param('id', ParseUUIDPipe) id: string): Promise<Tour> {
    return this.setPublished(id, false);
  }

  // Soft delete: tour row + its image files stay so an undelete is
  // possible. Image cleanup happens only via the update endpoint's diff.
  @Delete('tours/:id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const tour = await this.tours.findOne({ where: { id } });
    if (!tour) throw new NotFoundException('Tour not found');
    await this.tours.softDelete({ id });
  }

  private async setPublished(id: string, isPublished: boolean): Promise<Tour> {
    const tour = await this.tours.findOne({ where: { id } });
    if (!tour) throw new NotFoundException('Tour not found');
    tour.isPublished = isPublished;
    return this.tours.save(tour);
  }

  private applySort(
    qb: ReturnType<Repository<Tour>['createQueryBuilder']>,
    sort: AdminTourSort,
  ): void {
    switch (sort) {
      case 'oldest':
        qb.orderBy('t.createdAt', 'ASC');
        return;
      case 'price-high':
        qb.orderBy('t.priceVnd', 'DESC');
        return;
      case 'price-low':
        qb.orderBy('t.priceVnd', 'ASC');
        return;
      case 'title':
        qb.orderBy('t.title', 'ASC');
        return;
      case 'newest':
      default:
        qb.orderBy('t.createdAt', 'DESC');
        return;
    }
  }
}

// Silence unused-import warning for BadRequestException (may be needed later).
void BadRequestException;
