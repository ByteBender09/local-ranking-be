import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JourneyEntry, Venue } from '../../database/entities';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, JourneyEntry])],
  providers: [DiscoverService],
  controllers: [DiscoverController],
})
export class DiscoverModule {}
