import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue, Ward } from '../../database/entities';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { VenuesRepository } from './venues.repository';
import { WardNormalizerService } from './ward-normalizer.service';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, Ward])],
  controllers: [VenuesController],
  providers: [VenuesService, VenuesRepository, WardNormalizerService],
  exports: [VenuesService, VenuesRepository, WardNormalizerService, TypeOrmModule],
})
export class VenuesModule {}
