import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tour } from '../../database/entities';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tour])],
  controllers: [ToursController],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}
