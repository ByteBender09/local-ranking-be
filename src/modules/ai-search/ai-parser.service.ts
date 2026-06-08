import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouterClient } from './openrouter.client';
import type { AiConfig } from '../../config/configuration';
import type { ParsedIntent } from './types';

// Canonical lists embedded in the tool schema so the LLM never invents a
// city slug or category. Adding/removing here is the ONLY place to keep in
// sync with the rest of the BE.
const CITY_SLUGS = [
  'ho-chi-minh',
  'ha-noi',
  'da-nang',
  'hoi-an',
  'hue',
  'da-lat',
  'nha-trang',
  'ninh-binh',
  'sa-pa',
  'quang-ninh',
  'vung-tau',
  'phu-quoc',
] as const;

const CATEGORIES = [
  'cafe',
  'restaurant',
  'street_food',
  'viewpoint',
  'beach',
  'homestay',
  'bar',
  'museum',
  'park',
  'shopping',
] as const;

const SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_venues',
    description:
      "Parse the user's natural language venue search query into structured " +
      'filters. ONLY use this function — never reply with prose.',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['search', 'trip_plan', 'specific_venue', 'discover'],
          description:
            'search = filter venues; trip_plan = multi-day/area itinerary; ' +
            'specific_venue = user named a single place; discover = open-ended browse',
        },
        city_slugs: {
          type: 'array',
          items: { type: 'string', enum: CITY_SLUGS },
        },
        ward_query: {
          type: ['string', 'null'],
          description:
            'Raw ward or old district name as user wrote it ("Quận 3", "Bến Thành", "Phú Xuân").',
        },
        region: {
          type: ['string', 'null'],
          enum: ['north', 'central', 'south', null],
        },
        near_landmark: { type: ['string', 'null'] },
        categories: {
          type: 'array',
          items: { type: 'string', enum: CATEGORIES },
        },
        cuisine: { type: ['string', 'null'] },
        price_max: { type: ['integer', 'null'], minimum: 1, maximum: 4 },
        price_min: { type: ['integer', 'null'], minimum: 1, maximum: 4 },
        rating_min: { type: ['number', 'null'], minimum: 0, maximum: 5 },
        open_now: { type: 'boolean' },
        vibe_tags: { type: 'array', items: { type: 'string' } },
        time_of_day: {
          type: ['string', 'null'],
          enum: ['morning', 'afternoon', 'evening', 'night', null],
        },
        audience: {
          type: ['string', 'null'],
          enum: ['couple', 'family', 'solo', 'group', null],
        },
        result_count: { type: ['integer', 'null'] },
        sort: {
          type: ['string', 'null'],
          enum: ['upvotes', 'rating', 'newest', 'trending', null],
        },
        duration_days: { type: ['integer', 'null'] },
        ambiguous_terms: { type: 'array', items: { type: 'string' } },
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description:
            "Language the user wrote in. Use 'vi' for Vietnamese, 'en' for English " +
            "(or any non-Vietnamese language — the reranker replies in English).",
        },
      },
      required: [
        'intent',
        'city_slugs',
        'ward_query',
        'region',
        'near_landmark',
        'categories',
        'cuisine',
        'price_max',
        'price_min',
        'rating_min',
        'open_now',
        'vibe_tags',
        'time_of_day',
        'audience',
        'result_count',
        'sort',
        'duration_days',
        'ambiguous_terms',
        'language',
      ],
    },
  },
};

const SYSTEM_PROMPT = `You are a parser for a Vietnam travel-venue search app.
Bạn là parser query tìm kiếm địa điểm du lịch Việt Nam.

Your job: take a natural-language query (Vietnamese OR English) and call the
search_venues function with extracted filters.

ABSOLUTE RULES:
1. ONLY respond by calling the function — never write prose.
2. NEVER invent venue names. You only extract filters; you do not answer with places.
3. Detect the query language and set the "language" field:
   - "vi" if the user wrote in Vietnamese (including Vietglish like "cafe ở Đà Lạt")
   - "en" if the user wrote in English (or any other non-Vietnamese language — Korean,
     Japanese, etc. — the reranker will reply in English)
4. City mapping (case-insensitive, slug values):
   - Vietnamese: "Hà Nội"→ha-noi, "Sài Gòn"/"HCM"/"TP.HCM"/"Thành phố Hồ Chí Minh"→ho-chi-minh,
     "Đà Lạt"→da-lat, "Đà Nẵng"→da-nang, "Hội An"→hoi-an, "Huế"→hue,
     "Nha Trang"→nha-trang, "Sapa"/"Sa Pa"→sa-pa, "Phú Quốc"→phu-quoc,
     "Vũng Tàu"→vung-tau, "Hạ Long"/"Quảng Ninh"→quang-ninh, "Ninh Bình"→ninh-binh
   - English: "Hanoi"/"Ha Noi"→ha-noi, "Saigon"/"Ho Chi Minh"/"Ho Chi Minh City"/"HCMC"→ho-chi-minh,
     "Dalat"/"Da Lat"→da-lat, "Danang"/"Da Nang"→da-nang, "Hoi An"→hoi-an, "Hue"→hue,
     "Nha Trang"→nha-trang, "Sapa"→sa-pa, "Phu Quoc"/"Phuquoc"→phu-quoc,
     "Vung Tau"→vung-tau, "Halong"/"Ha Long"/"Quang Ninh"→quang-ninh, "Ninh Binh"→ninh-binh
5. ward_query: keep raw ward/district as written. Vietnamese: "Quận 3", "Hoàn Kiếm", "Bến Thành".
   English: "District 3"→ward_query="District 3" (server expands). "Old Quarter Hanoi" → wardQuery="Old Quarter".
6. Categories (English slugs always): cafe, restaurant, street_food, viewpoint, beach,
   homestay, bar, museum, park, shopping.
   - "lăng tẩm"/"đền chùa"/"di tích" / "temple"/"shrine"/"historic site" → ["museum"]
   - "bãi biển"/"biển" / "beach" → ["beach"] — BUT see rule 6a below for inland cities.
   - "homestay"/"hostel"/"airbnb"/"guesthouse" → ["homestay"]
   - "nghệ thuật"/"art"/"artsy"/"artistic"/"nghệ sĩ"/"sáng tạo"/"sống ảo nghệ thuật"
     / "gallery"/"creative" → ["viewpoint","museum"]
   - "bảo tàng"/"triển lãm" / "museum"/"exhibition" → ["museum"]
   - "view đẹp"/"ngắm cảnh"/"check-in cảnh"/"săn mây"/"đồi"/"núi"/"thác"
     / "scenic"/"viewpoint"/"lookout"/"hike"/"trekking"/"mountain"/"waterfall" → ["viewpoint"]
   - BAR / NIGHTLIFE (everything alcoholic / late-night goes to "bar"):
     "bar"/"quán bar"/"pub"/"club"/"hộp đêm"/"vũ trường"/"cocktail"/"craft beer"/
     "bia tươi"/"bia hơi"/"bia thủ công"/"brewery"/"rooftop bar"/"sky bar"/"speakeasy"/
     "whisky"/"wine bar"/"beer garden"/"vườn bia"/"nightlife"/"nightclub"/"DJ" → ["bar"].
     "rooftop" alone (without "bar"/"coffee") is AMBIGUOUS — if morning/cafe context →
     ["cafe"] + vibe_tags+=["rooftop"]; if evening/drinking context → ["bar"] +
     vibe_tags+=["rooftop"]; if pure ambiguous → ["bar","cafe"] and add "rooftop" to
     ambiguous_terms.
   - WALKING STREET / PHỐ CỔ:
     "phố đi bộ"/"walking street"/"phố cổ"/"old quarter"/"old town"/"phố Tây"/
     "Bùi Viện"/"Tạ Hiện"/"đèn lồng" → categories=["street_food"] (these zones are
     primarily food-and-drink strips in our data).

6a. INLAND-CITY BEACH GUARD: if the user mentions "biển"/"beach"/"bãi tắm" and the
    selected city is ONE OF: da-lat, ha-noi, sa-pa, ninh-binh, hue (no real coastline
    in our data), DO NOT set categories=["beach"]. Instead:
    - "biển + Đà Lạt/Sa Pa/Ninh Bình" usually means "hồ"/"đồi"/"thác" → ["viewpoint"]
    - "đường đi bộ ven biển + Huế" → ["street_food"] (it's the walking street, not real beach)
    - Add "beach" to ambiguous_terms so the FE can show a hint.
    Beach is real for: da-nang, hoi-an, nha-trang, phu-quoc, quang-ninh, vung-tau, ho-chi-minh
    (Vũng Tàu/Cần Giờ day-trip).
7. Price mapping (use price_min for "expensive only", price_max for "cheap or under"):
   - "rẻ"/"bình dân"/"sinh viên" / "cheap"/"budget"/"affordable" → price_max=2, price_min=null
   - "tầm trung" / "mid-range"/"moderate" → price_min=2, price_max=3
   - "sang chảnh"/"đắt"/"đắt tiền"/"cao cấp" / "luxury"/"high-end"/"fancy"/"expensive"/"upscale"
     → price_min=3, price_max=null
   - "siêu rẻ"/"dirt cheap" → price_max=1
   - "siêu sang"/"ultra luxury" → price_min=4
8. Vibe (free-form array, language as user wrote it):
   - Vietnamese: "chilling", "yên tĩnh", "sống ảo", "lãng mạn", "sôi động", "view đẹp",
     "rooftop", "có sân vườn", "có view biển", "săn mây", "view phố cổ", "view sông"
   - English: "chill", "quiet", "instagrammable", "romantic", "lively", "great view",
     "rooftop", "garden", "ocean view", "cozy", "cloud-hunting", "river view"
   - Vibes describe atmosphere, NOT the category. "rooftop" goes here when it's a
     modifier of an unrelated category (e.g. "rooftop cafe to work" → category=cafe,
     vibe=["rooftop"]).
9. Result count: "top X" / "X quán" / "X places" → result_count=X
10. Sort:
    - "hot"/"trending"/"đang được yêu thích" / "popular"/"trending"/"hottest" → "trending"
    - "mới"/"mới mở" / "newest"/"new"/"recently opened" → "newest"
    - "đánh giá cao"/"rating cao" / "highly rated"/"best rated"/"top rated" → "rating"
11. Trip plan intent: "mai đi <city>", "weekend ở <city>", "đi 2-3 ngày" /
    "going to <city> tomorrow", "weekend in <city>", "2-day trip" → intent="trip_plan".
    Weekend → duration_days=2 by default.
12. Audience: "2 người"/"cặp đôi" / "for two"/"couple"/"date" → "couple" (NOT group).
    "gia đình" / "family"/"with kids" → "family".
    "3-4 người" / "group of <n>" → "group" when n≥3.
    "một mình"/"solo" → "solo".
13. Time of day:
    - "ăn sáng" / "breakfast"/"morning" → "morning"
    - "ăn trưa" / "lunch" → "afternoon"
    - "ăn tối"/"buổi tối" / "dinner"/"evening" → "evening"
    - "đêm khuya"/"về đêm" / "late night"/"nightlife" → "night"
14. Landmark: "gần Hồ Gươm"/"cạnh sân bay" / "near Hoan Kiem Lake"/"close to the airport"
    → near_landmark (keep the proper-noun form the user wrote).
15. Cuisine ("đồ Hàn", "phở", "Korean food", "Vietnamese", "Italian") → cuisine field.
16. Unknown / non-extractable fields → null (scalar) or [] (array). ALL fields are required.

17. CITY STRENGTH HINTS — when the user query is vague ("đi Đà Lạt chơi gì?" /
    "what to do in Hoi An?") and no category is explicit, leave categories=[] but
    bias vibe_tags toward the city's signature. This is informational only — DO NOT
    force a category if the user was vague. The reranker reads this.
    - ho-chi-minh: bar/nightlife, cafe, street_food (Bùi Viện, Q1, Thảo Điền)
    - ha-noi:      bar (Tạ Hiện), street_food, museum, viewpoint (Hồ Gươm, phố cổ)
    - da-nang:     beach (Mỹ Khê), cafe, viewpoint (Bà Nà, Sơn Trà)
    - hoi-an:      street_food (phố cổ, đèn lồng), viewpoint, cafe
    - hue:         museum (Đại Nội, lăng tẩm), street_food, restaurant
    - da-lat:      viewpoint (núi, đồi chè, săn mây), homestay, cafe
    - nha-trang:   beach, viewpoint
    - ninh-binh:   viewpoint (Tràng An, hang Múa, Tam Cốc, di sản UNESCO)
    - sa-pa:       viewpoint (Fansipan, ruộng bậc thang), homestay
    - quang-ninh:  beach (Hạ Long, Bãi Cháy), viewpoint
    - vung-tau:    beach, cafe (view biển)
    - phu-quoc:    beach, viewpoint

18. SOFT FILTER vs HARD FILTER. Use vibe_tags (soft) when the user is describing
    atmosphere; use categories (hard) only when they explicitly named a venue type.
    "quán chill view đẹp ở Đà Lạt" → categories=[], vibe=["chill","view đẹp"] —
    let the reranker pick across cafes/bars/viewpoints. "quán bar chill ở Đà Lạt" →
    categories=["bar"], vibe=["chill"].`;

// Maps the snake_case tool-call args to the camelCase ParsedIntent type.
// LLM speaks snake_case (JSON-Schema convention), the rest of the BE uses
// camelCase — this is the boundary.
function toIntent(raw: Record<string, unknown>): ParsedIntent {
  return {
    intent: (raw.intent as ParsedIntent['intent']) ?? 'search',
    citySlugs: (raw.city_slugs as string[]) ?? [],
    wardQuery: (raw.ward_query as string | null) ?? null,
    region: (raw.region as ParsedIntent['region']) ?? null,
    nearLandmark: (raw.near_landmark as string | null) ?? null,
    categories: (raw.categories as ParsedIntent['categories']) ?? [],
    cuisine: (raw.cuisine as string | null) ?? null,
    priceMax: (raw.price_max as ParsedIntent['priceMax']) ?? null,
    priceMin: (raw.price_min as ParsedIntent['priceMin']) ?? null,
    ratingMin: (raw.rating_min as number | null) ?? null,
    openNow: (raw.open_now as boolean) ?? false,
    vibeTags: (raw.vibe_tags as string[]) ?? [],
    timeOfDay: (raw.time_of_day as ParsedIntent['timeOfDay']) ?? null,
    audience: (raw.audience as ParsedIntent['audience']) ?? null,
    resultCount: (raw.result_count as number | null) ?? null,
    sort: (raw.sort as ParsedIntent['sort']) ?? null,
    durationDays: (raw.duration_days as number | null) ?? null,
    ambiguousTerms: (raw.ambiguous_terms as string[]) ?? [],
    // Default to 'vi' when the model omits the field — safe because the
    // app's primary audience is Vietnamese; an over-eager Vietnamese
    // response to an English query is a smaller UX hit than the reverse
    // (English reply to a Vietnamese user looks broken).
    language: (raw.language as ParsedIntent['language']) ?? 'vi',
  };
}

@Injectable()
export class AiParserService {
  private readonly logger = new Logger(AiParserService.name);
  private readonly model: string;

  constructor(
    private readonly openrouter: OpenRouterClient,
    private readonly config: ConfigService,
  ) {
    this.model = this.config.get<AiConfig>('ai')!.parserModel;
  }

  // Returns null on any failure (transport, malformed JSON, missing tool
  // call). Caller is expected to fall back to plain keyword search rather
  // than surface an error to the user — silent degradation is the contract.
  async parse(query: string): Promise<ParsedIntent | null> {
    try {
      const res = await this.openrouter.chat({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query },
        ],
        tools: [SEARCH_TOOL],
        toolChoice: { type: 'function', function: { name: 'search_venues' } },
        temperature: 0,
      });

      const call = res.toolCalls[0];
      if (!call) {
        this.logger.warn(
          `Parser returned no tool call. content="${res.content.slice(0, 200)}"`,
        );
        return null;
      }
      const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
      return toIntent(args);
    } catch (e) {
      this.logger.error(`Parser failed: ${(e as Error).message}`);
      return null;
    }
  }
}
