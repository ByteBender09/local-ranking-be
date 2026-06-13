import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  City,
  Venue,
  User,
  Review,
  Vote,
  CheckIn,
  JourneyEntry,
  SavedVenue,
  Tour,
  TourStop,
  Brand,
  Trip,
  TripDestination,
  TripMember,
} from './entities';
import { DatabaseConfig } from '../config/configuration';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get<DatabaseConfig>('database')!;
        return {
          type: 'postgres' as const,
          url: db.url,
          entities: [City, Venue, User, Review, Vote, CheckIn, JourneyEntry, SavedVenue, Tour, TourStop, Brand, Trip, TripDestination, TripMember],
          migrations: [__dirname + '/migrations/*.{js,ts}'],
          synchronize: db.synchronize,
          // Auto-run pending migrations on boot in production so a redeploy
          // is enough — no shell access needed. Disable for local dev.
          migrationsRun:
            db.synchronize === false &&
            process.env.NODE_ENV === 'production',
          logging: db.logging,
          poolSize: db.poolSize,
          ssl: db.ssl ? { rejectUnauthorized: false } : false,
          extra: {
            max: db.poolSize,
            statement_timeout: 10_000,
            idle_in_transaction_session_timeout: 10_000,
            connectionTimeoutMillis: 5_000,
          },
          autoLoadEntities: true,
          retryAttempts: 5,
          retryDelay: 3_000,
          keepConnectionAlive: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
