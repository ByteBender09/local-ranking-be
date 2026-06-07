import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand, City, Tour, TourStop, Venue } from '../../database/entities';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';
import { TourManagementController } from './tour-management.controller';
import { TourManagementService } from './tour-management.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tour, TourStop, City, Venue, Brand]),
    // UploadCleanupService — tour updates diff the gallery + cover image
    // and unlink files dropped from disk so the upload volume doesn't
    // accumulate orphans.
    UploadsModule,
  ],
  controllers: [ToursController, TourManagementController],
  providers: [ToursService, TourManagementService],
  exports: [ToursService],
})
export class ToursModule {}
