import { Module } from '@nestjs/common';
import { PartnersController } from './partners.controller';

// MailModule is @Global so MailService is injectable without an explicit
// import here — keeps this module minimal.
@Module({
  controllers: [PartnersController],
})
export class PartnersModule {}
