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

export interface TourProviderInfo {
  name: string;
  shortName: string;
  verified: boolean;
}

@Entity({ name: 'tours' })
@Index('idx_tours_city_category', ['cityId', 'category'])
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

  @Column({ type: 'varchar', length: 500 })
  image: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
