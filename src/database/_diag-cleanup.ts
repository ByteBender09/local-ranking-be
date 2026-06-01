import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Venue } from './entities';

// Deletes only source='google' venues (test/imported), leaves curated intact.
async function main(): Promise<void> {
  const ds = new DataSource({ ...dataSourceOptions, synchronize: false });
  await ds.initialize();
  const res = await ds.getRepository(Venue).delete({ source: 'google' });
  console.log(`Deleted ${res.affected ?? 0} google-sourced venue(s).`);
  await ds.destroy();
}
main().catch((e) => { console.error(e); process.exit(1); });
