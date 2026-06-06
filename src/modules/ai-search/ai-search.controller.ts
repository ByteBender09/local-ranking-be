import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiSearchRequestDto } from './dto/ai-search.dto';
import { AiSearchService } from './ai-search.service';
import type { AiSearchResponse } from './types';

// AI search is GATED behind login. The JwtAuthGuard registered globally
// in AppModule rejects unauthenticated requests with 401 — the FE catches
// that and redirects to /login?next=/search?q=... Two reasons:
//   (1) Cost discipline — each call burns LLM tokens. Tying it to an
//       authenticated user lets us per-user-rate-limit & audit abuse.
//   (2) Personalization runway — once we have a user id we can later add
//       saved searches, "find me places like the ones I've upvoted", etc.
@Controller('ai')
export class AiSearchController {
  constructor(private readonly ai: AiSearchService) {}

  // POST so the query body isn't logged in access logs (LLM input may
  // contain personal context like "buồn"). Throttler limits per IP using
  // the dedicated 'ai' tier — see config.throttle.ai.
  @Post('search')
  @Throttle({ ai: { ttl: 60_000, limit: 8 } })
  async search(@Body() dto: AiSearchRequestDto): Promise<AiSearchResponse> {
    return this.ai.search(dto.query, { currentCitySlug: dto.currentCitySlug });
  }
}
