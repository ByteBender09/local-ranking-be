import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PublicCache } from '../../common/decorators/public-cache.decorator';
import { Category, Tour } from '../../database/entities';
import { ToursService } from './tours.service';

@Controller('tours')
@Public()
@PublicCache({ sMaxAge: 300, staleWhileRevalidate: 3600 })
export class ToursController {
  constructor(private readonly tours: ToursService) {}

  @Get()
  list(
    @Query('citySlug') citySlug?: string,
    @Query('category') category?: Category,
    @Query('venueId') venueId?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ): Promise<Tour[]> {
    return this.tours.list(
      citySlug,
      category,
      venueId,
      Math.min(Math.max(limit ?? 20, 1), 50),
    );
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string): Promise<Tour> {
    return this.tours.bySlug(slug);
  }
}
