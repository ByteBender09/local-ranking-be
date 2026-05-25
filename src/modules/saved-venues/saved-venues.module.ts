import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedVenue, Venue } from '../../database/entities';
import { SavedVenuesController } from './saved-venues.controller';
import { SavedVenuesService } from './saved-venues.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedVenue, Venue])],
  controllers: [SavedVenuesController],
  providers: [SavedVenuesService],
  exports: [SavedVenuesService],
})
export class SavedVenuesModule {}
