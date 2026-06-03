import { MigrationInterface, QueryRunner } from 'typeorm';

// One-time data cleanup: strip the trailing rating + review-count suffix that
// the Apify importer used to bake into venue descriptions, e.g.
//   "Bãi biển tại Hội An Đông, Đà Nẵng. 4.4★ (411 đánh giá)"
//        → "Bãi biển tại Hội An Đông, Đà Nẵng."
// Rating/review count are shown by the UI from venue.rating / reviewCount, so
// embedding them in the text duplicated the stars and went stale. The importer
// (import-apify.ts buildDescription) no longer appends it, so this only fixes
// rows imported before that change.
//
// The pattern matches, anchored at the end of the string:
//   <space>* ( <rating>★ <space>* (<count> đánh giá)?  |  (<count> đánh giá) ) <space>*
// Character classes ([0-9], [(], [)], [[:space:]]) are used instead of \d, \(,
// \s because this Postgres' ARE engine doesn't treat those escapes as intended.
// Venues with a real Google description (no such suffix) are left untouched.
const SUFFIX_RE =
  '[[:space:]]*([0-9]+([.,][0-9]+)?★[[:space:]]*([(][0-9]+[[:space:]]*đánh giá[)])?|[(][0-9]+[[:space:]]*đánh giá[)])[[:space:]]*$';

export class StripRatingFromVenueDescription1780000200000
  implements MigrationInterface
{
  name = 'StripRatingFromVenueDescription1780000200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "venues"
         SET "description" = regexp_replace("description", $1, '')
       WHERE "description" ~ $1`,
      [SUFFIX_RE],
    );
  }

  public async down(): Promise<void> {
    // Irreversible: the stripped "<rating>★ (<n> đánh giá)" text cannot be
    // reconstructed from the cleaned description. No-op.
  }
}
