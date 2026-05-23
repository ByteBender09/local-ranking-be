import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Venue } from './venue.entity';
import { User } from './user.entity';

@Entity({ name: 'journey_entries' })
@Unique('uq_journey_user_venue', ['userId', 'venueId'])
@Index('idx_journey_user_added', ['userId', 'addedAt'])
export class JourneyEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'venue_id' })
  venueId: string;

  @ManyToOne(() => Venue, (v) => v.journeyEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (u) => u.journeyEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;
}
