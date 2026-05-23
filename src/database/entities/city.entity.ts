import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Venue } from './venue.entity';
import { Tour } from './tour.entity';

export type Region = 'north' | 'central' | 'south';

@Entity({ name: 'cities' })
export class City {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120, name: 'name_en' })
  nameEn: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  region: Region;

  @Column({ type: 'varchar', length: 500, name: 'cover_image' })
  coverImage: string;

  @Column({ type: 'varchar', length: 200 })
  tagline: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  highlights: string[];

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @OneToMany(() => Venue, (v) => v.city)
  venues: Venue[];

  @OneToMany(() => Tour, (t) => t.city)
  tours: Tour[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
