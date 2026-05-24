import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn, JourneyEntry, User, Venue } from '../../database/entities';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';

@Module({
  imports: [TypeOrmModule.forFeature([CheckIn, User, Venue, JourneyEntry])],
  controllers: [CheckInsController],
  providers: [CheckInsService],
})
export class CheckInsModule {}
