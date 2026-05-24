import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CheckIn,
  City,
  Review,
  Tour,
  User,
  Venue,
  Vote,
} from '../../database/entities';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminCitiesVenuesController } from './admin-cities-venues.controller';
import { AdminCitiesVenuesService } from './admin-venues.service';
import { CitiesModule } from '../cities/cities.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Venue, City, Tour, Review, Vote, CheckIn]),
    CitiesModule,
  ],
  controllers: [AdminController, AdminCitiesVenuesController],
  providers: [AdminService, AdminCitiesVenuesService],
})
export class AdminModule {}
