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
import { User } from './user.entity';

// One follow edge per (follower, following) pair. The convention is
// "follower follows following" — i.e. follower_id is the one initiating
// the action, following_id is the target. `users.follower_count` is the
// denormalised count of rows where following_id = users.id, kept in sync
// by UsersService.follow/unfollow inside a transaction.
@Entity({ name: 'user_follows' })
@Unique('uq_user_follow_pair', ['followerId', 'followingId'])
@Index('idx_user_follow_following_created', ['followingId', 'createdAt'])
@Index('idx_user_follow_follower_created', ['followerId', 'createdAt'])
export class UserFollow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'follower_id' })
  followerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower: User;

  @Column({ type: 'uuid', name: 'following_id' })
  followingId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'following_id' })
  following: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
