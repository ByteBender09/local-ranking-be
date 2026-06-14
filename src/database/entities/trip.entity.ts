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
import { User } from './user.entity';
import { TripDestination } from './trip-destination.entity';
import { TripMember } from './trip-member.entity';

// Who can view a trip. Evaluated ON TOP of each memory's own `isPublic`:
//  - private   → owner + joined members only
//  - followers → anyone who follows the owner (+ owner + members)
//  - public    → anyone
export type TripVisibility = 'private' | 'followers' | 'public';

// A "journey room". The owner picks dates + destinations and invites friends.
// Member memories (check-ins) are NOT stored on the trip — they're derived by
// querying members' public check-ins whose createdAt falls in [startDate,
// endDate]. See TripsService.listMemories.
@Entity({ name: 'trips' })
@Index('idx_trips_owner', ['ownerId'])
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'varchar', length: 500, name: 'cover_image', nullable: true })
  coverImage: string | null;

  @Column({ type: 'timestamptz', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'timestamptz', name: 'end_date' })
  endDate: Date;

  @Column({ type: 'varchar', length: 16, default: 'followers' })
  visibility: TripVisibility;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt: Date | null;

  @OneToMany(() => TripDestination, (d) => d.trip)
  destinations: TripDestination[];

  @OneToMany(() => TripMember, (m) => m.trip)
  members: TripMember[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
