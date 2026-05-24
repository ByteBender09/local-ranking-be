import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City, Venue } from '../../database/entities';
import { CitiesService } from './cities.service';
import { CitiesController } from './cities.controller';

@Module({
  imports: [TypeOrmModule.forFeature([City, Venue])],
  providers: [CitiesService],
  controllers: [CitiesController],
  exports: [CitiesService],
})
export class CitiesModule {}
