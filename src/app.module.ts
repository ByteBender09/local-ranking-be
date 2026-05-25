import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { User } from './database/entities';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { ThrottleConfig, UploadConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HealthController } from './common/controllers/health.controller';
import { IpThrottlerGuard } from './common/guards/ip-throttler.guard';
import { BlockedReadOnlyGuard } from './common/guards/blocked-readonly.guard';
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
import { SavedVenuesModule } from './modules/saved-venues/saved-venues.module';
import { ToursModule } from './modules/tours/tours.module';
import { DiscoverModule } from './modules/discover/discover.module';
import { AdminModule } from './modules/admin/admin.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { MailModule } from './modules/mail/mail.module';
import { BrandingModule } from './modules/branding/branding.module';
import { PartnersModule } from './modules/partners/partners.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      cache: true,
    }),
    CacheModule.register({ isGlobal: true, ttl: 60 * 1000, max: 5_000 }),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const upload = cfg.get<UploadConfig>('upload')!;
        const rootPath = resolve(upload.diskPath);
        // Ensure the volume directory exists on boot so multer + ServeStatic
        // never race on a missing folder right after deploy.
        if (!existsSync(rootPath)) {
          try {
            mkdirSync(rootPath, { recursive: true });
          } catch {
            /* read-only on some envs — ignore */
          }
        }
        return [
          {
            rootPath,
            serveRoot: '/uploads',
            serveStaticOptions: {
              maxAge: 7 * 24 * 60 * 60 * 1000,
              fallthrough: true,
            },
          },
        ];
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const t = cfg.get<ThrottleConfig>('throttle')!;
        return {
          throttlers: [
            {
              name: t.short.name,
              ttl: t.short.ttl * 1000,
              limit: t.short.limit,
            },
            {
              name: t.default.name,
              ttl: t.default.ttl * 1000,
              limit: t.default.limit,
            },
            { name: t.auth.name, ttl: t.auth.ttl * 1000, limit: t.auth.limit },
          ],
        };
      },
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([User]),
    AuthModule,
    CitiesModule,
    VenuesModule,
    UsersModule,
    ReviewsModule,
    VotesModule,
    CheckInsModule,
    JourneyModule,
    SavedVenuesModule,
    ToursModule,
    DiscoverModule,
    AdminModule,
    UploadsModule,
    MailModule,
    BrandingModule,
    PartnersModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: IpThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: BlockedReadOnlyGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
