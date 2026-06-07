import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UserUploadsController } from './user-uploads.controller';
import { UploadCleanupService } from './upload-cleanup.service';

@Module({
  controllers: [UploadsController, UserUploadsController],
  providers: [UploadCleanupService],
  exports: [UploadCleanupService],
})
export class UploadsModule {}
