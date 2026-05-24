import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import {
  CheckIn,
  JourneyEntry,
  Review,
  Tour,
  Venue,
  Vote,
} from './entities';

dotenv.config();

// One-shot cleanup for venue content that was inserted by older versions of
// the seed (the now-removed REAL_VENUES fixture). Run this once to flush
// every venue + its dependent rows. Cities and Users are preserved.
//
// Usage:  npm run reset:venues
async function main(): Promise<void> {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();

  await ds.transaction(async (m) => {
    const v = await m.count(Venue);
    const r = await m.count(Review);
    const c = await m.count(CheckIn);
    const vo = await m.count(Vote);
    const j = await m.count(JourneyEntry);
    const t = await m.count(Tour);

    console.log('Before:', { venues: v, reviews: r, checkIns: c, votes: vo, journey: j, tours: t });

    // Order matters: drop children first to avoid FK violations even though
    // the entities declare ON DELETE CASCADE — being explicit is safer.
    await m.createQueryBuilder().delete().from(Review).execute();
    await m.createQueryBuilder().delete().from(Vote).execute();
    await m.createQueryBuilder().delete().from(CheckIn).execute();
    await m.createQueryBuilder().delete().from(JourneyEntry).execute();
    await m.createQueryBuilder().delete().from(Tour).execute();
    await m.createQueryBuilder().delete().from(Venue).execute();

    // Reset users' denormalised counter
    await m.query('UPDATE "users" SET check_in_count = 0');
  });

  console.log(
    '\n✓ Venues + all dependent rows wiped. Cities and users preserved.',
  );
  console.log(
    '  Add venues from scratch via the admin UI at /admin/cities/<slug>.',
  );
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
