import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City, Tour, User, Venue } from '../../database/entities';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';
import { TourManagementController } from './tour-management.controller';
import { TourManagementService } from './tour-management.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tour, City, Venue, User])],
  controllers: [ToursController, TourManagementController],
  providers: [ToursService, TourManagementService],
  exports: [ToursService],
})
export class ToursModule {}
