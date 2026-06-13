import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CheckIn,
  Trip,
  TripDestination,
  TripMember,
  User,
  UserFollow,
} from '../../database/entities';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trip,
      TripDestination,
      TripMember,
      CheckIn,
      User,
      UserFollow,
    ]),
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
