import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintToNumber } from '../transformers';
import { Review } from './review.entity';
import { Vote } from './vote.entity';
import { CheckIn } from './check-in.entity';
import { JourneyEntry } from './journey-entry.entity';

export interface UserSocials {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  threads?: string;
  facebook?: string;
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  handle: string;

  @Index({ unique: true, where: '"google_id" IS NOT NULL' })
  @Column({ type: 'varchar', length: 64, name: 'google_id', nullable: true })
  googleId: string | null;

  @Index({ unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 500 })
  avatar: string;

  @Column({ type: 'varchar', length: 280, default: '' })
  bio: string;

  @Column({ type: 'varchar', length: 80, name: 'city_slug', nullable: true })
  citySlug: string | null;

  @Column({ type: 'int', name: 'check_in_count', default: 0 })
  checkInCount: number;

  @Column({ type: 'int', name: 'follower_count', default: 0 })
  followerCount: number;

  @Column({ type: 'boolean', name: 'booking_enabled', default: false })
  bookingEnabled: boolean;

  @Column({
    type: 'bigint',
    name: 'booking_price_vnd',
    nullable: true,
    transformer: bigintToNumber,
  })
  bookingPriceVnd: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  socials: UserSocials;

  @Column({ type: 'varchar', length: 80, name: 'instagram_handle', nullable: true })
  instagramHandle: string | null;

  @Column({ type: 'varchar', length: 64, name: 'instagram_user_id', nullable: true })
  instagramUserId: string | null;

  @Column({ type: 'text', name: 'instagram_access_token', nullable: true })
  instagramAccessToken: string | null;

  @Column({ type: 'timestamptz', name: 'instagram_linked_at', nullable: true })
  instagramLinkedAt: Date | null;

  @OneToMany(() => Review, (r) => r.user)
  reviews: Review[];

  @OneToMany(() => Vote, (v) => v.user)
  votes: Vote[];

  @OneToMany(() => CheckIn, (c) => c.user)
  checkIns: CheckIn[];

  @OneToMany(() => JourneyEntry, (j) => j.user)
  journeyEntries: JourneyEntry[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
