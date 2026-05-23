import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { ThrottleConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HealthController } from './common/controllers/health.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { CitiesModule } from './modules/cities/cities.module';
import { VenuesModule } from './modules/venues/venues.module';
import { UsersModule } from './modules/users/users.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { VotesModule } from './modules/votes/votes.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { JourneyModule } from './modules/journey/journey.module';
import { ToursModule } from './modules/tours/tours.module';
import { DiscoverModule } from './modules/discover/discover.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      cache: true,
    }),
    CacheModule.register({ isGlobal: true, ttl: 60 * 1000, max: 5_000 }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const t = cfg.get<ThrottleConfig>('throttle')!;
        return [{ ttl: t.ttl * 1000, limit: t.limit }];
      },
    }),
    DatabaseModule,
    AuthModule,
    CitiesModule,
    VenuesModule,
    UsersModule,
    ReviewsModule,
    VotesModule,
    CheckInsModule,
    JourneyModule,
    ToursModule,
    DiscoverModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
