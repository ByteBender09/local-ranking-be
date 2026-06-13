import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Trip } from './trip.entity';
import { City } from './city.entity';

// An ordered city stop on a trip (the "Where are you going?" screen). The
// first destination (lowest sortOrder) is the start, the last is the end.
@Entity({ name: 'trip_destinations' })
@Index('idx_trip_destinations_trip_order', ['tripId', 'sortOrder'])
export class TripDestination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (t) => t.destinations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ type: 'uuid', name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
