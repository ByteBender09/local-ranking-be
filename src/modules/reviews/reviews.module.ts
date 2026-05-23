import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review, Venue } from '../../database/entities';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Venue])],
  providers: [ReviewsService],
  controllers: [ReviewsController],
})
export class ReviewsModule {}
