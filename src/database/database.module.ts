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
  Tour,
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
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.name,
          entities: [City, Venue, User, Review, Vote, CheckIn, JourneyEntry, Tour],
          migrations: [__dirname + '/migrations/*.{js,ts}'],
          synchronize: db.synchronize,
          logging: db.logging,
          poolSize: db.poolSize,
          extra: {
            max: db.poolSize,
            statement_timeout: 10_000,
            idle_in_transaction_session_timeout: 10_000,
          },
          autoLoadEntities: true,
          cache: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
