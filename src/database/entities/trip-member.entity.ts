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
import { Trip } from './trip.entity';
import { User } from './user.entity';

export type TripMemberRole = 'owner' | 'member';
// invited → owner sent an invite, awaiting response.
// joined  → accepted; this user's memories feed into the trip.
// declined→ rejected the invite (kept as a tombstone so re-invites are explicit).
export type TripMemberStatus = 'invited' | 'joined' | 'declined';

@Entity({ name: 'trip_members' })
@Unique('uq_trip_member_pair', ['tripId', 'userId'])
@Index('idx_trip_members_user', ['userId'])
@Index('idx_trip_members_trip_status', ['tripId', 'status'])
export class TripMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (t) => t.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 8, default: 'member' })
  role: TripMemberRole;

  @Column({ type: 'varchar', length: 8, default: 'invited' })
  status: TripMemberStatus;

  @Column({ type: 'uuid', name: 'invited_by_id', nullable: true })
  invitedById: string | null;

  @Column({ type: 'timestamptz', name: 'joined_at', nullable: true })
  joinedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
