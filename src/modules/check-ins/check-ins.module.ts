import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn, JourneyEntry, User, Venue } from '../../database/entities';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CheckIn, User, Venue, JourneyEntry]),
    UploadsModule,
  ],
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
