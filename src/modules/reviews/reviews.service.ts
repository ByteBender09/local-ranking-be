import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Review, Venue } from '../../database/entities';
import { UpsertReviewDto } from './dto/upsert-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    private readonly dataSource: DataSource,
  ) {}

  listByVenue(venueId: string, limit = 30): Promise<Review[]> {
    // Only expose safe public author fields — NEVER the full user row, which
    // carries email / googleId / instagramAccessToken. `isSynthetic` lets the
    // web render importer-sourced (Google) reviews with photo + name only.
    return this.reviews.find({
      where: { venueId },
      relations: { user: true },
      select: {
        id: true,
        venueId: true,
        userId: true,
        rating: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        user: {
          id: true,
          handle: true,
          name: true,
          avatar: true,
          isSynthetic: true,
        },
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async upsert(
    venueSlug: string,
    userId: string,
    dto: UpsertReviewDto,
  ): Promise<Review> {
    return this.dataSource.transaction(async (manager) => {
      const venue = await manager.findOne(Venue, { where: { slug: venueSlug } });
      if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

      let review = await manager.findOne(Review, {
        where: { venueId: venue.id, userId },
      });

      if (review) {
        review.rating = dto.rating;
        review.body = dto.body;
        await manager.save(review);
      } else {
        review = manager.create(Review, {
          venueId: venue.id,
          userId,
          rating: dto.rating,
          body: dto.body,
        });
        await manager.save(review);
      }

      const { avg, count } = await manager
        .createQueryBuilder(Review, 'r')
        .select('AVG(r.rating)', 'avg')
        .addSelect('COUNT(r.id)', 'count')
        .where('r.venue_id = :id', { id: venue.id })
        .getRawOne<{ avg: string; count: string }>() ?? { avg: '0', count: '0' };

      await manager.update(
        Venue,
        { id: venue.id },
        blendRating(venue, parseFloat(avg) || 0, parseInt(count, 10) || 0),
      );

      return review;
    });
  }

  async remove(venueSlug: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const venue = await manager.findOne(Venue, { where: { slug: venueSlug } });
      if (!venue) throw new NotFoundException(`Venue not found: ${venueSlug}`);

      const result = await manager.delete(Review, {
        venueId: venue.id,
        userId,
      });
      if (!result.affected) return;

      const { avg, count } = await manager
        .createQueryBuilder(Review, 'r')
        .select('COALESCE(AVG(r.rating), 0)', 'avg')
        .addSelect('COUNT(r.id)', 'count')
        .where('r.venue_id = :id', { id: venue.id })
        .getRawOne<{ avg: string; count: string }>() ?? { avg: '0', count: '0' };

      await manager.update(
        Venue,
        { id: venue.id },
        blendRating(venue, parseFloat(avg) || 0, parseInt(count, 10) || 0),
      );
    });
  }
}

/**
 * Combine a venue's pristine external rating/count (e.g. Foursquare) with its
 * in-app review aggregate into the displayed `rating`/`reviewCount`. For curated
 * venues (externalReviewCount = 0) this reduces to the in-app-only values, so
 * behaviour is unchanged. The external base is read from the venue row and never
 * written back here, so it can never be wiped by review churn.
 */
function blendRating(
  venue: Venue,
  localAvg: number,
  localCount: number,
): { rating: number; reviewCount: number } {
  const extCount = venue.externalReviewCount ?? 0;
  const extRating = venue.externalRating ?? 0;
  const combinedCount = localCount + extCount;
  const combinedRating =
    combinedCount > 0
      ? (localAvg * localCount + extRating * extCount) / combinedCount
      : 0;
  return {
    rating: Math.round(combinedRating * 100) / 100,
    reviewCount: combinedCount,
  };
}
