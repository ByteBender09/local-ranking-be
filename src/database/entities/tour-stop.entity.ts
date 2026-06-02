import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { City } from './city.entity';
import { Tour } from './tour.entity';
import { Venue } from './venue.entity';

// An ordered stop within a tour's itinerary.
//
// A stop is ALWAYS bound to a city. The venue is OPTIONAL: a stop can be
// "just a city" (e.g. "Day 2 — Hội An, free roaming") or a city + a specific
// venue ("Day 1 — The Note Coffee, Hà Nội"). The number of distinct cities
// across a tour's stops is what makes it intra-city (1 city) vs inter-province
// (2+ cities) — see Tour.scope.
@Entity({ name: 'tour_stops' })
@Index('idx_tour_stops_tour_order', ['tourId', 'order'])
export class TourStop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tour_id' })
  tourId: string;

  @ManyToOne(() => Tour, (t) => t.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tour_id' })
  tour: Tour;

  // 0-based position in the itinerary. Unique per tour (enforced by the
  // idx_tour_stops_tour_order index + service-side normalisation).
  @Column({ type: 'smallint' })
  order: number;

  @Column({ type: 'uuid', name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  // Optional: the specific venue visited at this stop. NULL = city-only stop.
  // ON DELETE SET NULL so deleting a venue downgrades the stop to city-only
  // rather than dropping it from the itinerary.
  @Column({ type: 'uuid', name: 'venue_id', nullable: true })
  venueId: string | null;

  @ManyToOne(() => Venue, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue | null;
}
