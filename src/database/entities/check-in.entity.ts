import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Venue } from './venue.entity';
import { User } from './user.entity';

// A venue can be checked in many times (one per Vietnam calendar day, enforced
// in the service). Each check-in carries 0 or 1 memory (comment + photos) inline.
// `memoryCreatedAt` stamps when the memory was first written and drives the
// 30-minute edit/delete lock.
//
// A check-in is EITHER tied to a catalog venue (venueId set, place* null) OR to
// a custom off-catalog place (venueId null, placeName + lat + lng set). The
// latter powers "check in somewhere not in our venues DB" inside a trip.
@Entity({ name: 'check_ins' })
@Index('idx_checkins_user_created', ['userId', 'createdAt'])
@Index('idx_checkins_user_venue_created', ['userId', 'venueId', 'createdAt'])
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'venue_id', nullable: true })
  venueId: string | null;

  @ManyToOne(() => Venue, (v) => v.checkIns, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue | null;

  // Custom off-catalog place. All null for venue-based check-ins; set for
  // custom ones (venueId is then null).
  @Column({ type: 'varchar', length: 160, name: 'place_name', nullable: true })
  placeName: string | null;

  @Column({
    type: 'varchar',
    length: 240,
    name: 'place_address',
    nullable: true,
  })
  placeAddress: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (u) => u.checkIns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  photos: string[];

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  friends: string[];

  @Column({ type: 'boolean', name: 'is_public', default: true })
  isPublic: boolean;

  // Null until the user first writes a memory on this check-in. Once set, the
  // memory is editable/deletable only within 30 minutes of this timestamp.
  @Column({ type: 'timestamptz', name: 'memory_created_at', nullable: true })
  memoryCreatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete — set by manager.softDelete()/softRemove(). TypeORM's
  // find/findOne automatically exclude rows where this is non-null unless
  // `withDeleted: true` is passed, so existing read paths just stop
  // returning the row. Files referenced in `photos` are intentionally NOT
  // unlinked on soft delete so the row is recoverable from DB if needed.
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
