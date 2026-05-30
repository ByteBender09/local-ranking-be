import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn, SavedVenue, Venue, Vote } from '../../database/entities';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, CheckIn, Vote, SavedVenue])],
  providers: [DiscoverService],
  controllers: [DiscoverController],
})
export class DiscoverModule {}
