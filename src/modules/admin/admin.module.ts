import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Brand,
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
import { AdminToursController } from './admin-tours.controller';
import { AdminBrandsController } from './admin-brands.controller';
import { CitiesModule } from '../cities/cities.module';
import { VenuesModule } from '../venues/venues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Venue, City, Tour, Review, Vote, CheckIn, Brand]),
    CitiesModule,
    // Imported to surface WardNormalizerService — used on admin venue
    // create/update so editing the raw district immediately re-resolves
    // ward_canonical without a backfill pass.
    VenuesModule,
  ],
  controllers: [
    AdminController,
    AdminCitiesVenuesController,
    AdminToursController,
    AdminBrandsController,
  ],
  providers: [AdminService, AdminCitiesVenuesService],
})
export class AdminModule {}
