import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintToNumber, numericToNumber } from '../transformers';
import { Brand } from './brand.entity';
import { City } from './city.entity';
import type { Category } from './venue.entity';
import { TourStop } from './tour-stop.entity';
import { User } from './user.entity';

// Geographic span of a tour, derived from the distinct cities in its stops:
//   intra_city      — all stops in a single city (nội thành)
//   inter_province  — stops span 2+ cities (liên tỉnh)
export type TourScope = 'intra_city' | 'inter_province';

export interface TourProviderInfo {
  name: string;
  shortName: string;
  verified: boolean;
  // Optional: URL of the brand's logo. Denormalised into the tour's
  // `provider` JSON so the FE can render the brand's logo on each tour card
  // without an extra user lookup. Synced whenever the owner's branding changes.
  logoUrl?: string | null;
}

export interface TourPromotion {
  id: string;
  title: string;
  description?: string;
  code?: string;
  discountPct?: number;
  url?: string;
  validFrom?: string;
  validTo?: string;
}

@Entity({ name: 'tours' })
@Index('idx_tours_city_category', ['cityId', 'category'])
@Index('idx_tours_owner', ['ownerId'])
export class Tour {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  slug: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  // Primary city = the first stop's city. DERIVED from `stops` on every save
  // (see TourManagementService). Kept as a real column so existing list/filter
  // queries (`city.slug = :citySlug`) and clients reading `tour.cityId` keep
  // working without a join through tour_stops.
  @Column({ type: 'uuid', name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, (c) => c.tours, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  // Ordered itinerary. The source of truth for cities/venues a tour visits;
  // `cityId`, `venueIds` and `scope` are all derived from this on save.
  @OneToMany(() => TourStop, (s) => s.tour, { cascade: true })
  stops: TourStop[];

  // intra_city vs inter_province — derived from the distinct cities in `stops`.
  @Index('idx_tours_scope')
  @Column({ type: 'varchar', length: 16, default: 'intra_city' })
  scope: TourScope;

  @Column({ type: 'varchar', length: 24 })
  category: Category;

  @Column({ type: 'smallint', name: 'duration_hours' })
  durationHours: number;

  @Column({ type: 'bigint', name: 'price_vnd', transformer: bigintToNumber })
  priceVnd: number;

  // Cover image. Empty when the business hasn't uploaded any photos —
  // VenueCards then fall back to the brand logo (provider.logoUrl). Kept as
  // a denormalised first-image pointer so list endpoints don't have to peek
  // into the `images` array.
  @Column({ type: 'varchar', length: 500, default: '' })
  image: string;

  // Photo gallery — shown in the tour detail modal. Empty array is fine.
  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
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

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  highlights: string[];

  @Column({ type: 'jsonb' })
  provider: TourProviderInfo;

  // Description / itinerary the business writes themselves
  @Column({ type: 'text', default: '' })
  description: string;

  // External booking URL the business wants traffic to go to
  @Column({ type: 'varchar', length: 500, name: 'booking_url', nullable: true })
  bookingUrl: string | null;

  // Venues from the system catalog this tour visits. DERIVED from `stops`
  // (the non-null venueIds, de-duplicated, in stop order) on every save. Kept
  // as a column so the venue→tours "related tours" query (`:venueId = ANY(...)`)
  // and clients reading `tour.venueIds` keep working.
  @Column({
    type: 'uuid',
    array: true,
    name: 'venue_ids',
    default: () => 'ARRAY[]::uuid[]',
  })
  venueIds: string[];

  // Embedded promotions / discount codes for this tour
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  promotions: TourPromotion[];

  // The brand (catalog object, NOT a user account) that provides this tour.
  // null = system-managed entry (→ SITE_PROVIDER). `provider` below is the
  // denormalised display copy of this brand, refreshed on every save.
  @Index('idx_tours_brand')
  @Column({ type: 'uuid', name: 'brand_id', nullable: true })
  brandId: string | null;

  @ManyToOne(() => Brand, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand | null;

  // DEPRECATED: legacy link to the User that created/owned a tour, from when a
  // brand was a User. Kept nullable for back-compat with the branding module +
  // older rows; new admin-created tours leave it null and use `brandId`.
  @Column({ type: 'uuid', name: 'owner_id', nullable: true })
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @Column({ type: 'boolean', name: 'is_published', default: true })
  isPublished: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete — softRemove() sets this. Cover image + gallery are kept
  // on disk so the tour can be restored; only images explicitly dropped
  // via the tour editor get unlinked.
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
