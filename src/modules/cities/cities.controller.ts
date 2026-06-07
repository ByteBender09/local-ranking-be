import { Controller, Get, Param } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { Public } from '../../common/decorators/public.decorator';
import { PublicCache } from '../../common/decorators/public-cache.decorator';
import { City } from '../../database/entities';

@Controller('cities')
@Public()
@PublicCache({ sMaxAge: 600, staleWhileRevalidate: 86400 })
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  @Get()
  list(): Promise<City[]> {
    return this.cities.findAll();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string): Promise<City> {
    return this.cities.findBySlug(slug);
  }
}
