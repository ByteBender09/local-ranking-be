import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ward } from '../../database/entities';
import {
  NormalizableWard,
  ResolveResult,
  resolveWardText,
  toNormalizable,
  normalize,
} from './ward-resolver';

export interface NormalizeInput {
  citySlug: string;
  rawDistrict: string | null | undefined;
  // Reserved for Stage 3 geo fallback (added later — wired via a second
  // pass after text resolution returns null).
  lat?: number | null;
  lng?: number | null;
}

// NestJS-injectable wrapper around the pure resolver in ward-resolver.ts.
// Holds an in-memory index of all wards (~600 entries) so per-request
// matching is sub-ms. Caller must call `refreshCache()` after editing the
// wards table (e.g. re-running seed-wards.ts in dev).
//
// The service does NOT cache results — the matching itself is so cheap
// (Map + array.filter on ~600 normalized strings) that adding a result
// cache would be premature.
@Injectable()
export class WardNormalizerService implements OnModuleInit {
  private readonly logger = new Logger(WardNormalizerService.name);

  private byCitySlug = new Map<string, NormalizableWard[]>();

  constructor(
    @InjectRepository(Ward)
    private readonly wardRepo: Repository<Ward>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCache();
  }

  async refreshCache(): Promise<void> {
    const wards = await this.wardRepo
      .createQueryBuilder('w')
      .innerJoin('w.city', 'c')
      .select(['w.id', 'w.name', 'w.type', 'w.aliasesOldDistrict', 'w.aliasesOldWards', 'w.aliasesUser'])
      .addSelect('c.slug', 'city_slug')
      .getRawAndEntities();

    const bySlug = new Map<string, NormalizableWard[]>();
    for (let i = 0; i < wards.entities.length; i++) {
      const w = wards.entities[i];
      const citySlug = wards.raw[i].city_slug as string;
      const list = bySlug.get(citySlug) ?? [];
      list.push(...toNormalizable([w]));
      bySlug.set(citySlug, list);
    }
    this.byCitySlug = bySlug;
    this.logger.log(
      `Ward cache loaded: ${wards.entities.length} wards across ${bySlug.size} cities`,
    );
  }

  // Resolve a raw district string for a venue in the given city. Returns
  // null if nothing matched — caller can decide to flag for admin review,
  // try geo fallback, or fall through to is_published=false on import.
  resolve(input: NormalizeInput): ResolveResult | null {
    const wards = this.byCitySlug.get(input.citySlug);
    if (!wards) return null;
    return resolveWardText(input.rawDistrict, wards);
  }

  // Returns all canonical wards in a city whose name/alias matches the
  // free-form query string. Used by the search API to expand a user
  // query like "Quận 3" into the list of new wards that absorbed District
  // 3 territory ("Bàn Cờ", "Xuân Hòa", "Nhiêu Lộc"), then filter venues
  // by ward_canonical IN those names.
  //
  // Returns the EMPTY array if the query doesn't match anything — caller
  // should treat that as "no ward filter, search the whole city".
  expandQueryToWards(citySlug: string, query: string): string[] {
    const wards = this.byCitySlug.get(citySlug);
    if (!wards || !query) return [];
    const q = normalize(query);
    if (!q) return [];

    const hits = new Set<string>();
    for (const w of wards) {
      if (w.nameNorm === q || w.nameNorm.includes(q)) {
        hits.add(w.name);
        continue;
      }
      if (w.aliasesNorm.some((a) => a === q || a.includes(q))) {
        hits.add(w.name);
      }
    }
    return [...hits];
  }
}
