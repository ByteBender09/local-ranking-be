import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn, Venue, Vote } from '../../database/entities';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, CheckIn, Vote])],
  providers: [DiscoverService],
  controllers: [DiscoverController],
})
export class DiscoverModule {}
