import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { numericToNumber } from '../transformers';
import { Venue } from './venue.entity';
import { User } from './user.entity';

@Entity({ name: 'reviews' })
@Unique('uq_review_user_venue', ['userId', 'venueId'])
@Index('idx_reviews_venue_created', ['venueId', 'createdAt'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'venue_id' })
  venueId: string;

  @ManyToOne(() => Venue, (v) => v.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (u) => u.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'numeric',
    precision: 2,
    scale: 1,
    transformer: numericToNumber,
  })
  rating: number;

  @Column({ type: 'text' })
  body: string;

  // Photos the reviewer attached on Google. Stored as raw provider URLs
  // (lh3.googleusercontent.com) — those hosts are in the next/image
  // whitelist + SafeImage's fallback chain so the FE renders them
  // directly without needing a CDN rehost pass.
  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  photos: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
