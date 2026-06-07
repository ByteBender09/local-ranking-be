import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
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
  Ward,
  AiSearchCache,
  UserFollow,
} from './entities';

dotenv.config();

const ssl = process.env.DB_SSL === 'true';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [City, Venue, User, Review, Vote, CheckIn, JourneyEntry, SavedVenue, Tour, TourStop, Brand, Ward, AiSearchCache, UserFollow],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
  poolSize: parseInt(process.env.DB_POOL_SIZE ?? '20', 10),
  ssl: ssl ? { rejectUnauthorized: false } : false,
};

export default new DataSource(dataSourceOptions);
