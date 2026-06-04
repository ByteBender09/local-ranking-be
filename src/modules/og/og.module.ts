import { Module } from '@nestjs/common';
import { VenuesModule } from '../venues/venues.module';
import { OgController } from './og.controller';

@Module({
  imports: [VenuesModule],
  controllers: [OgController],
})
export class OgModule {}
