import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouterClient } from './openrouter.client';
import type { AiConfig } from '../../config/configuration';
import type { Venue } from '../../database/entities';
import type { ParsedIntent } from './types';

// Compact venue projection sent to the reranker LLM. Anything not in this
// list adds tokens without changing the ranking — the LLM doesn't care
// about externalRaw, slug, etc. Keep it tight.
interface RerankCandidate {
  id: string;
  name: string;
  category: string;
  ward: string;
  rating: number;
  upvotes: number;
  price: number;
  tags: string[];
  description: string;
}

interface RerankOutput {
  // 2-3 sentence opener that introduces the recommendations. Written as
  // a friend, addressing the user's mood/context if any. Per-venue
  // reasons are gone — one warm message reads better than N short labels
  // under cards (it was prior UX, scrapped).
  intro: string;
  // Ordered list of venue ids only. The LLM may shorten when fewer
  // candidates genuinely match the vibe — accepted.
  top: Array<{ venue_id: string }>;
}

const RERANK_TOOL = {
  type: 'function' as const,
  function: {
    name: 'rerank_venues',
    description:
      'Pick the top venues from the candidate list AND write a single short ' +
      'intro paragraph that opens the recommendations.',
    parameters: {
      type: 'object',
      properties: {
        intro: {
          type: 'string',
          description:
            'A warm, 2-3 sentence opener that introduces the recommendations to ' +
            "the user. Acknowledge their mood/context if any (e.g. 'hôm nay buồn'), " +
            'explain the angle of the picks, and feel like a friend recommending — ' +
            "NOT like AI labelling. MUST be in the language indicated by the system prompt. " +
            'Under 280 chars.',
        },
        top: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              venue_id: { type: 'string' },
            },
            required: ['venue_id'],
          },
        },
      },
      required: ['intro', 'top'],
    },
  },
};

@Injectable()
export class AiRerankerService {
  private readonly logger = new Logger(AiRerankerService.name);
  private readonly model: string;

  constructor(
    private readonly openrouter: OpenRouterClient,
    private readonly config: ConfigService,
  ) {
    this.model = this.config.get<AiConfig>('ai')!.rerankerModel;
  }

  // Returns null when there are too few candidates or the LLM call fails.
  // Caller falls back to filter-only ordering with no intro.
  async rerank(
    query: string,
    intent: ParsedIntent,
    candidates: Venue[],
    topK: number,
  ): Promise<{
    orderedVenueIds: string[];
    intro: string;
  } | null> {
    if (candidates.length <= 2) return null;

    // Cap at 30 so the prompt stays under ~3K tokens.
    const trimmed = candidates.slice(0, 30);
    const compact: RerankCandidate[] = trimmed.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      ward: v.wardCanonical ?? v.district ?? '',
      rating: Number(v.rating) || 0,
      upvotes: v.upvotes ?? 0,
      price: v.priceRange ?? 2,
      tags: (v.tags ?? []).slice(0, 6),
      description: (v.description ?? '').slice(0, 240),
    }));

    // Localized prompt strings — see below for the per-language wording.
    // The system prompt PINS the intro language so the model doesn't drift.
    const isEn = intent.language === 'en';
    const t = isEn
      ? {
          system:
            'You re-rank Vietnam travel venues and write a single warm intro ' +
            'sentence to open the recommendations. Talk like a friend — never ' +
            'invent venue ids. Call rerank_venues. CRITICAL: write the intro ' +
            'in ENGLISH.',
          userIntro:
            `Original query: "${query}"\n` +
            (intent.vibeTags.length ? `User vibe: ${intent.vibeTags.join(', ')}\n` : '') +
            (intent.audience ? `Audience: ${intent.audience}\n` : '') +
            (intent.timeOfDay ? `Time: ${intent.timeOfDay}\n` : '') +
            '\n' +
            `Pick the top ${topK} venues that best match. Write a single warm ` +
            "2-3 sentence intro that opens these recommendations. Address the user's " +
            'mood/situation, explain the angle of the picks. Read like a friend — ' +
            'avoid "I am an AI" / robotic phrasing. Under 280 chars.\n' +
            'DO NOT invent venue ids — only pick from the list.',
        }
      : {
          system:
            'Bạn là re-ranker địa điểm du lịch Việt Nam, đồng thời viết một câu ' +
            'mở đầu thân thiện giới thiệu danh sách gợi ý. Nói chuyện như bạn bè — ' +
            'không xưng "tôi là AI", không bịa venue id. Gọi rerank_venues. ' +
            'QUAN TRỌNG: viết intro bằng TIẾNG VIỆT.',
          userIntro:
            `Query gốc: "${query}"\n` +
            (intent.vibeTags.length ? `Vibe người dùng: ${intent.vibeTags.join(', ')}\n` : '') +
            (intent.audience ? `Đối tượng: ${intent.audience}\n` : '') +
            (intent.timeOfDay ? `Thời điểm: ${intent.timeOfDay}\n` : '') +
            '\n' +
            `Chọn top ${topK} venue phù hợp nhất. Viết 1 đoạn mở đầu (2-3 câu) ` +
            'để giới thiệu các gợi ý — đề cập đến tâm trạng/hoàn cảnh của user nếu có, ' +
            'giải thích góc nhìn của các pick. Đọc như bạn bè khuyên — tránh kiểu ' +
            '"Tôi là AI" hay phong cách robot. Dưới 280 ký tự.\n' +
            'TUYỆT ĐỐI KHÔNG bịa venue_id — chỉ chọn từ danh sách.',
        };

    const userPrompt = `${t.userIntro}\n\nCandidates:\n${JSON.stringify(compact, null, 0)}`;

    try {
      const res = await this.openrouter.chat({
        model: this.model,
        messages: [
          { role: 'system', content: t.system },
          { role: 'user', content: userPrompt },
        ],
        tools: [RERANK_TOOL],
        toolChoice: { type: 'function', function: { name: 'rerank_venues' } },
        temperature: 0.4,
        maxTokens: 700,
      });

      const call = res.toolCalls[0];
      if (!call) {
        this.logger.warn('Reranker returned no tool call');
        return null;
      }
      const args = JSON.parse(call.function.arguments) as RerankOutput;
      if (!Array.isArray(args.top) || args.top.length === 0) return null;

      const validIds = new Set(trimmed.map((v) => v.id));
      const orderedVenueIds: string[] = [];
      for (const pick of args.top) {
        if (!validIds.has(pick.venue_id)) {
          this.logger.warn(`Reranker invented id ${pick.venue_id} — skipping`);
          continue;
        }
        if (orderedVenueIds.includes(pick.venue_id)) continue;
        orderedVenueIds.push(pick.venue_id);
      }
      if (orderedVenueIds.length === 0) return null;

      const intro = (args.intro ?? '').trim().slice(0, 600);
      if (!intro) return null;

      return { orderedVenueIds, intro };
    } catch (e) {
      this.logger.error(`Reranker failed: ${(e as Error).message}`);
      return null;
    }
  }
}
