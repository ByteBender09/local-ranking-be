import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Venue } from './venue.entity';
import { User } from './user.entity';

@Entity({ name: 'check_ins' })
@Unique('uq_checkin_user_venue', ['userId', 'venueId'])
@Index('idx_checkins_user_created', ['userId', 'createdAt'])
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'venue_id' })
  venueId: string;

  @ManyToOne(() => Venue, (v) => v.checkIns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (u) => u.checkIns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  photos: string[];

  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  friends: string[];

  @Column({ type: 'boolean', name: 'is_public', default: true })
  isPublic: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
