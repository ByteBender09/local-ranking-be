import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from '../../database/entities';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { VenuesRepository } from './venues.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Venue])],
  controllers: [VenuesController],
  providers: [VenuesService, VenuesRepository],
  exports: [VenuesService, VenuesRepository, TypeOrmModule],
})
export class VenuesModule {}
