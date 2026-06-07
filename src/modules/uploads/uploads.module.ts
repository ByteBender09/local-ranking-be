import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UserUploadsController } from './user-uploads.controller';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadIngestionService } from './upload-ingestion.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UploadsController, UserUploadsController],
  providers: [UploadCleanupService, UploadIngestionService],
  exports: [UploadCleanupService, UploadIngestionService],
})
export class UploadsModule {}
