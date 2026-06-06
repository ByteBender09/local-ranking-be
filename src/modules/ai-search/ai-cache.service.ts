import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AiSearchCache } from '../../database/entities';
import type { AiConfig } from '../../config/configuration';
import type { ParsedIntent } from './types';

interface CachedResult {
  intent: ParsedIntent;
  venueIds: string[];
  intro: string | null;
  usedReranker: boolean;
}

@Injectable()
export class AiCacheService {
  private readonly logger = new Logger(AiCacheService.name);
  private readonly ttlSeconds: number;

  constructor(
    @InjectRepository(AiSearchCache)
    private readonly repo: Repository<AiSearchCache>,
    private readonly config: ConfigService,
  ) {
    this.ttlSeconds = this.config.get<AiConfig>('ai')!.cacheTtlSeconds;
  }

  // Normalize before hashing so semantically-identical queries collide on
  // one row: lowercased, diacritic-stripped, whitespace-collapsed. The
  // hash MUST match what `key()` returns at write time, so this is the
  // single source of truth.
  key(query: string): string {
    const normalized = query
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    return createHash('sha256').update(normalized).digest('hex');
  }

  // Read-through: returns null on miss OR on expired hit. Expired rows
  // are NOT deleted here — they get overwritten by the next set() with
  // the same hash. Read-time TTL is cheaper than a cleanup cron and avoids
  // race conditions where a cron deletes a row mid-read.
  async get(query: string): Promise<CachedResult | null> {
    const hash = this.key(query);
    const row = await this.repo.findOne({ where: { queryHash: hash } });
    if (!row) return null;

    const ageMs = Date.now() - row.createdAt.getTime();
    if (ageMs > this.ttlSeconds * 1000) {
      this.logger.debug(`Cache hit but expired (age ${Math.round(ageMs / 1000)}s)`);
      return null;
    }

    // Bump hit count + last-accessed without blocking the response. Fire
    // and forget — losing a counter increment under load is fine.
    void this.repo
      .createQueryBuilder()
      .update(AiSearchCache)
      .set({ hitCount: () => 'hit_count + 1', lastAccessedAt: new Date() })
      .where('id = :id', { id: row.id })
      .execute()
      .catch((e: unknown) => this.logger.warn(`hit_count bump failed: ${String(e)}`));

    return {
      intent: row.intent as unknown as ParsedIntent,
      venueIds: row.venueIds,
      intro: row.intro,
      usedReranker: row.usedReranker,
    };
  }

  // Write-through. Upsert by query_hash — re-running a query overwrites
  // the stale entry instead of leaving an old row + a fresh row both
  // backed by the same hash.
  async set(query: string, payload: CachedResult): Promise<void> {
    const hash = this.key(query);
    const truncatedQuery = query.slice(0, 500);
    try {
      const intentJson = payload.intent as unknown as Record<string, unknown>;
      const existing = await this.repo.findOne({ where: { queryHash: hash } });
      if (existing) {
        existing.query = truncatedQuery;
        existing.intent = intentJson;
        existing.venueIds = payload.venueIds;
        existing.intro = payload.intro;
        existing.reasons = null;
        existing.usedReranker = payload.usedReranker;
        existing.createdAt = new Date(); // TTL restarts
        existing.lastAccessedAt = new Date();
        await this.repo.save(existing);
      } else {
        await this.repo.save(
          this.repo.create({
            queryHash: hash,
            query: truncatedQuery,
            intent: intentJson,
            venueIds: payload.venueIds,
            intro: payload.intro,
            reasons: null,
            usedReranker: payload.usedReranker,
            hitCount: 0,
            lastAccessedAt: new Date(),
          }),
        );
      }
    } catch (e) {
      // Cache write failing is non-fatal — the user already has their
      // result, they just won't benefit from cache on the next call.
      this.logger.warn(`Cache set failed: ${(e as Error).message}`);
    }
  }
}
