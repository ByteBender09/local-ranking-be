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
import { City } from './city.entity';

// Canonical post-2025 administrative units (phường/xã/đặc khu) for tourism
// destinations. Vietnam's July 2025 reform abolished the district level — this
// table is the single source of truth for "where exactly is a venue".
//
// `aliases_*` arrays hold the strings users / scrapers may write that should
// resolve to this ward. They're searched by WardNormalizerService during
// import and by the search API when a query mentions an old district name
// (e.g. "Quận 3") that no longer exists administratively but is still how
// people talk about a location.
export type WardType = 'phuong' | 'xa' | 'dac_khu';

@Entity({ name: 'wards' })
@Unique('uq_wards_city_name', ['cityId', 'name'])
@Index('idx_wards_city', ['cityId'])
export class Ward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  type: WardType;

  // Old district names that this ward now covers (e.g. "Quận 1"). One ward
  // may map back to multiple old districts and one old district usually maps
  // to many new wards — many-to-many through aliases is intentional.
  @Column({
    type: 'text',
    array: true,
    name: 'aliases_old_district',
    default: () => 'ARRAY[]::text[]',
  })
  aliasesOldDistrict: string[];

  // Pre-2025 phường/xã names absorbed into this ward (e.g. "Bến Nghé" → new
  // ward "Sài Gòn"). These are the values most likely to appear in scraped
  // address strings collected before the reform.
  @Column({
    type: 'text',
    array: true,
    name: 'aliases_old_wards',
    default: () => 'ARRAY[]::text[]',
  })
  aliasesOldWards: string[];

  // Free-form user-facing synonyms (e.g. "trung tâm Sài Gòn", "phố cổ").
  @Column({
    type: 'text',
    array: true,
    name: 'aliases_user',
    default: () => 'ARRAY[]::text[]',
  })
  aliasesUser: string[];

  // Optional bbox for fast pre-filter before point-in-polygon (Stage 3 geo
  // fallback, added later). Stored as [minLng, minLat, maxLng, maxLat].
  @Column({ type: 'double precision', array: true, nullable: true })
  bbox: number[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
