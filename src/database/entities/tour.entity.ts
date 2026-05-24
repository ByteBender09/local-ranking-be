import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintToNumber, numericToNumber } from '../transformers';
import { City } from './city.entity';
import type { Category } from './venue.entity';
import { User } from './user.entity';

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

  @Column({ type: 'uuid', name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, (c) => c.tours, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

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

  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  highlights: string[];

  @Column({ type: 'jsonb' })
  provider: TourProviderInfo;

  // Description / itinerary the business writes themselves
  @Column({ type: 'text', default: '' })
  description: string;

  // External booking URL the business wants traffic to go to
  @Column({ type: 'varchar', length: 500, name: 'booking_url', nullable: true })
  bookingUrl: string | null;

  // Venues from the system catalog this tour visits
  @Column({
    type: 'uuid',
    array: true,
    name: 'venue_ids',
    default: () => "ARRAY[]::uuid[]",
  })
  venueIds: string[];

  // Embedded promotions / discount codes for this tour
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  promotions: TourPromotion[];

  // null = system-managed catalog entry. Non-null = a business owns it.
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
}
