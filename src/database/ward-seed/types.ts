import type { WardType } from '../entities/ward.entity';

// One row of seed data for the `wards` table. `name` must match the
// official post-2025 phường/xã/đặc khu name verbatim — it's the value
// `venues.ward_canonical` will store, and the value the search API filters
// on. Aliases are matched case-insensitively + accent-tolerantly by
// WardNormalizerService.
export interface WardSeed {
  name: string;
  type: WardType;
  // Names of pre-2025 districts (quận/huyện/thị xã) that this ward now
  // covers wholly or partly. Used to resolve scraped data written before
  // July 2025 and to expand user queries like "Quận 3".
  aliasesOldDistrict?: string[];
  // Names of pre-2025 wards/communes that were merged INTO this ward.
  // The big win: Apify scrapes from 2024 frequently say "Bến Nghé"
  // when the venue is now in new ward "Sài Gòn".
  aliasesOldWards?: string[];
  // Free-form user-facing synonyms — neighborhoods, landmarks,
  // colloquial names. Optional; add when you spot a query pattern.
  aliasesUser?: string[];
}

// Seed file for one tourism destination (matches cities.slug). A single
// destination can map to multiple admin provinces post-reform (e.g. Vũng Tàu
// is admin-part-of HCM now but stays a separate destination in this app).
export interface DestinationSeed {
  citySlug: string;
  wards: WardSeed[];
}
