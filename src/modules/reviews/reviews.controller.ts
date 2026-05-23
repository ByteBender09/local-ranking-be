import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Review } from '../../database/entities';
import { UpsertReviewDto } from './dto/upsert-review.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('venues/:venueId/reviews')
  list(@Param('venueId') venueId: string): Promise<Review[]> {
    return this.reviews.listByVenue(venueId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('venues/slug/:slug/reviews/me')
  upsert(
    @Param('slug') slug: string,
    @Body() body: UpsertReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Review> {
    return this.reviews.upsert(slug, user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('venues/slug/:slug/reviews/me')
  @HttpCode(204)
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.reviews.remove(slug, user.id);
  }
}
