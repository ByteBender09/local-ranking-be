import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericToNumber } from '../transformers';
import { City } from './city.entity';
import { Review } from './review.entity';
import { Vote } from './vote.entity';
import { CheckIn } from './check-in.entity';
import { JourneyEntry } from './journey-entry.entity';
import { SavedVenue } from './saved-venue.entity';

export type Category =
  | 'cafe'
  | 'restaurant'
  | 'street_food'
  | 'viewpoint'
  | 'beach'
  | 'homestay'
  | 'bar'
  | 'museum'
  | 'park'
  | 'shopping';

export type VenueSource = 'curated' | 'google';

@Entity({ name: 'venues' })
@Index('idx_venues_city_category', ['cityId', 'category'])
@Index('idx_venues_upvotes', ['upvotes'])
@Index('idx_venues_rating', ['rating'])
@Index('idx_venues_source', ['source'])
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160 })
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 24 })
  category: Category;

  @Column({ type: 'uuid', name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, (c) => c.venues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ type: 'varchar', length: 80 })
  district: string;

  @Column({ type: 'varchar', length: 240 })
  address: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  images: string[];

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
    transformer: numericToNumber,
  })
  rating: number;

  @Column({ type: 'int', name: 'review_count', default: 0 })
  reviewCount: number;

  @Column({ type: 'int', default: 0 })
  upvotes: number;

  @Column({ type: 'smallint', name: 'price_range', default: 2 })
  priceRange: number;

  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  tags: string[];

  @Column({ type: 'varchar', length: 64 })
  hours: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Index()
  @Column({ type: 'boolean', name: 'is_published', default: true })
  isPublished: boolean;

  // ── Provenance & externally-sourced data (source-neutral) ─────────────────
  // 'curated' = hand-seeded; 'foursquare' = imported via the Places importer.
  @Column({ type: 'varchar', length: 16, default: 'curated' })
  source: VenueSource;

  // External provider place id (e.g. Foursquare fsq_place_id) — lets the
  // importer dedupe + re-sync. Partial-unique (NULL for curated rows).
  @Column({ type: 'varchar', length: 300, name: 'external_id', nullable: true })
  externalId: string | null;

  // Original provider rating/review count, normalised to a 0–5 scale. NEVER
  // overwritten by ReviewsService — `rating`/`reviewCount` above hold the
  // blended (external + in-app) display value; these preserve the pristine
  // source for the blend + re-sync.
  @Column({
    type: 'numeric',
    precision: 3,
    scale: 2,
    name: 'external_rating',
    default: 0,
    transformer: numericToNumber,
  })
  externalRating: number;

  @Column({ type: 'int', name: 'external_review_count', default: 0 })
  externalReviewCount: number;

  // Full weekly opening hours from the provider. The compact `hours` column
  // above stays the short string the current UI shows.
  @Column({ type: 'jsonb', name: 'external_opening_hours', nullable: true })
  externalOpeningHours: string[] | null;

  @Column({ type: 'timestamptz', name: 'external_synced_at', nullable: true })
  externalSyncedAt: Date | null;

  // Full raw payload from the source (e.g. the entire Apify/Google Maps item:
  // reviews, phone, website, price, popular times…). Stored so we never have to
  // re-scrape — FE/app may not use it now, but it's there for later features.
  @Column({ type: 'jsonb', name: 'external_raw', nullable: true })
  externalRaw: Record<string, unknown> | null;

  @OneToMany(() => Review, (r) => r.venue)
  reviews: Review[];

  @OneToMany(() => Vote, (v) => v.venue)
  votes: Vote[];

  @OneToMany(() => CheckIn, (c) => c.venue)
  checkIns: CheckIn[];

  @OneToMany(() => JourneyEntry, (j) => j.venue)
  journeyEntries: JourneyEntry[];

  @OneToMany(() => SavedVenue, (s) => s.venue)
  savedBy: SavedVenue[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
