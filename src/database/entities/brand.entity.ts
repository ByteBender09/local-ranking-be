import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// A brand / tour provider as a STANDALONE catalog object — NOT a user account.
// Admins create and manage brands directly; tours reference a brand via
// `tour.brandId`. The brand's display fields are denormalised into each tour's
// `provider` JSON on save so list endpoints don't need to join.
@Entity({ name: 'brands' })
export class Brand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_brands_name')
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 16, name: 'short_name' })
  shortName: string;

  @Column({ type: 'varchar', length: 500, name: 'logo_url', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 500, name: 'website_url', nullable: true })
  websiteUrl: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'contact_email',
    nullable: true,
  })
  contactEmail: string | null;

  // Drives the blue "verified" check on tour cards.
  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'timestamptz', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
