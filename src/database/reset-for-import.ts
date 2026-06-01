import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import {
  CheckIn,
  JourneyEntry,
  Review,
  SavedVenue,
  Tour,
  Venue,
  Vote,
} from './entities';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Destructive reset ahead of the Google import.
//
// KEEPS:  cities, users (incl. tour brands / company accounts), tours.
// DROPS:  venues + every venue-dependent row (reviews, votes, check-ins,
//         journey entries, saved venues).
// ALSO:   clears every tour's `venueIds` (they pointed at venues that are about
//         to be deleted and re-imported with fresh ids → would dangle), and
//         resets users.check_in_count to 0.
//
// SAFETY: does nothing unless you pass `--yes`. Without it, just prints counts.
//   Dry run:  npm run reset:for-import
//   Execute:  npm run reset:for-import -- --yes
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const confirmed = process.argv.includes('--yes');
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();

  const counts = {
    venues: await ds.manager.count(Venue),
    reviews: await ds.manager.count(Review),
    votes: await ds.manager.count(Vote),
    checkIns: await ds.manager.count(CheckIn),
    journey: await ds.manager.count(JourneyEntry),
    saved: await ds.manager.count(SavedVenue),
    tours: await ds.manager.count(Tour),
  };
  console.log('Current counts:', counts);

  if (!confirmed) {
    console.log(
      '\n⚠ DRY RUN — nothing deleted. Re-run with `-- --yes` to execute:\n' +
        '   • DROP: venues, reviews, votes, check-ins, journey, saved_venues\n' +
        `   • CLEAR venueIds on ${counts.tours} tours (kept)\n` +
        '   • KEEP: cities, users, tours\n' +
        '   • RESET users.check_in_count = 0',
    );
    await ds.destroy();
    return;
  }

  await ds.transaction(async (m) => {
    // Children first (explicit, even though FKs cascade).
    await m.createQueryBuilder().delete().from(Review).execute();
    await m.createQueryBuilder().delete().from(Vote).execute();
    await m.createQueryBuilder().delete().from(CheckIn).execute();
    await m.createQueryBuilder().delete().from(JourneyEntry).execute();
    await m.createQueryBuilder().delete().from(SavedVenue).execute();
    await m.createQueryBuilder().delete().from(Venue).execute();

    // Kept tours referenced now-deleted venues — clear the dangling links so
    // owners/admins re-attach valid venues (the editor enforces ≥1 venue).
    await m.query(`UPDATE "tours" SET "venue_ids" = '{}'::uuid[]`);

    // Denormalised per-user counter no longer has any check-ins behind it.
    await m.query('UPDATE "users" SET check_in_count = 0');
  });

  console.log(
    '\n✓ Reset done. Kept cities + users + tours (venueIds cleared). ' +
      'Ready for the Google import.',
  );
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
