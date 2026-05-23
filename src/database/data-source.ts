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
  Tour,
} from './entities';

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [City, Venue, User, Review, Vote, CheckIn, JourneyEntry, Tour],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
  poolSize: parseInt(process.env.DB_POOL_SIZE ?? '20', 10),
};

export default new DataSource(dataSourceOptions);
