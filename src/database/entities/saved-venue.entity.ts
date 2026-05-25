import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
  Unique,
} from 'typeorm';
import { Venue } from './venue.entity';
import { User } from './user.entity';

// Wishlist of venues the user wants to visit later. Distinct from JourneyEntry
// (visited) and CheckIn (visited + memory). One row per (user, venue).
@Entity({ name: 'saved_venues' })
@Unique('uq_saved_user_venue', ['userId', 'venueId'])
@Index('idx_saved_user_added', ['userId', 'addedAt'])
export class SavedVenue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'venue_id' })
  venueId: string;

  @ManyToOne(() => Venue, (v) => v.savedBy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (u) => u.savedVenues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;
}
