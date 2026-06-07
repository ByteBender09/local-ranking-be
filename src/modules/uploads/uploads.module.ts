import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from '../../database/entities';
import { UploadsController } from './uploads.controller';
import { UserUploadsController } from './user-uploads.controller';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadIngestionService } from './upload-ingestion.service';
import { VenueImageRehostQueue } from './venue-image-rehost.queue';

@Module({
  imports: [TypeOrmModule.forFeature([Venue])],
  controllers: [UploadsController, UserUploadsController],
  providers: [
    UploadCleanupService,
    UploadIngestionService,
    VenueImageRehostQueue,
  ],
  exports: [
    UploadCleanupService,
    UploadIngestionService,
    VenueImageRehostQueue,
  ],
})
export class UploadsModule {}
