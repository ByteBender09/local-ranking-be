import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UserUploadsController } from './user-uploads.controller';

@Module({
  controllers: [UploadsController, UserUploadsController],
})
export class UploadsModule {}
