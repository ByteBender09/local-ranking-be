import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Param,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { Venue } from '../../database/entities';
import { ListVenuesDto } from './dto/list-venues.dto';
import { VenuesService } from './venues.service';

@Controller('venues')
@Public()
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  list(@Query() filter: ListVenuesDto): Promise<PaginatedResponse<Venue>> {
    return this.venues.list(filter);
  }

  @Get('trending')
  trending(
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ): Promise<Venue[]> {
    return this.venues.trending(Math.min(Math.max(limit, 1), 50));
  }

  @Get('search')
  search(
    @Query('q', new DefaultValuePipe('')) q: string,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ): Promise<Venue[]> {
    return this.venues.search(q, Math.min(Math.max(limit, 1), 30));
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string): Promise<Venue> {
    return this.venues.getBySlug(slug);
  }
}
