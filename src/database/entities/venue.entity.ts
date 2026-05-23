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

@Entity({ name: 'venues' })
@Index('idx_venues_city_category', ['cityId', 'category'])
@Index('idx_venues_upvotes', ['upvotes'])
@Index('idx_venues_rating', ['rating'])
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

  @OneToMany(() => Review, (r) => r.venue)
  reviews: Review[];

  @OneToMany(() => Vote, (v) => v.venue)
  votes: Vote[];

  @OneToMany(() => CheckIn, (c) => c.venue)
  checkIns: CheckIn[];

  @OneToMany(() => JourneyEntry, (j) => j.venue)
  journeyEntries: JourneyEntry[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
