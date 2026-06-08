// Pure ward-resolution functions — no NestJS, no DI, no DB. Used by both
// WardNormalizerService (which wraps these with a Nest-injectable cache)
// and by standalone scripts (backfill, diagnostics, importers) that boot
// only a DataSource. Keeping the matching logic out of the service class
// means there's one source of truth and the tests cover both call sites.

export type WardType = 'phuong' | 'xa' | 'dac_khu';
export type WardResolutionMethod = 'exact' | 'alias' | 'geo' | 'manual';

export interface NormalizableWard {
  name: string;
  nameNorm: string;
  type: WardType;
  aliasesNorm: string[];
}

export interface WardLike {
  name: string;
  type: WardType;
  aliasesOldDistrict: string[];
  aliasesOldWards: string[];
  aliasesUser: string[];
}

export interface ResolveResult {
  wardCanonical: string;
  wardType: WardType;
  method: WardResolutionMethod;
  matchedVia?: string;
}

// Lowercase, strip Vietnamese accents, normalize admin prefixes, collapse
// punctuation/whitespace. Applied to both the raw scraped string AND to
// every seed name + alias up front so the comparison is symmetric.
//
//   "Phường 6, Quận 3" → "phuong 6 quan 3"
//   "Q.1"              → "quan 1"
//   "Đà Lạt"           → "da lat"
//   "Xã Tả Van"        → "ta van"          (xã prefix stripped after diacritic)
//   "TP. Hồ Chí Minh"  → "ho chi minh"
export function normalize(s: string): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/q\.\s*/g, 'quan ')
    .replace(/p\.\s*/g, 'phuong ')
    .replace(/tp\.?\s*/g, '')
    .replace(/tx\.?\s*/g, '')
    .replace(/tt\.?\s*/g, '')
    // English → Vietnamese admin-unit aliases, applied SYMMETRICALLY to
    // both stored aliases and incoming queries. "District 3" and "Quận 3"
    // collapse to the same normalized "quan 3" so we don't have to dual-
    // list every English variant in every ward seed. Same trick for
    // "Ward N" → "phuong N" (English speakers occasionally write that).
    .replace(/\bdistrict\s+(\d+)/g, 'quan $1')
    .replace(/\bdist\.?\s+(\d+)/g, 'quan $1')
    .replace(/\bward\s+(\d+)/g, 'phuong $1')
    .replace(/[,\.;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Strip leading admin-unit prefixes that prepend the actual name. We
    // do NOT strip "phuong " because phường names are often a number
    // ("Phường 6") and the prefix carries the identifier.
    .replace(/^(xa|huyen|thi xa|thi tran|thanh pho) /, '');
}

// Scraped address fragments are typically comma- or hyphen-separated.
// Each token gets tried independently against the index:
//   "Phường 6, Quận 3"     → ["Phường 6", "Quận 3"]
//   "Xuân Trường - Đà Lạt" → ["Xuân Trường", "Đà Lạt"]
export function splitToTokens(s: string): string[] {
  return s
    .split(/[,\-–]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// Build the in-memory matching index from raw Ward rows. Pre-computing the
// normalized forms once is critical — without this we'd re-normalize every
// alias on every venue lookup (1844 venues × 305 wards × ~5 aliases each =
// 2.8M wasted regex passes per backfill run).
export function toNormalizable(wards: WardLike[]): NormalizableWard[] {
  return wards.map((w) => ({
    name: w.name,
    nameNorm: normalize(w.name),
    type: w.type,
    aliasesNorm: [
      ...w.aliasesOldDistrict.map(normalize),
      ...w.aliasesOldWards.map(normalize),
      ...w.aliasesUser.map(normalize),
    ],
  }));
}

// Core matching pipeline. Stage 3 (geo point-in-polygon) lives in
// ward-geo-resolver.ts and is composed on top of this — text-only first,
// fall back to geo only when text returns null.
//
// Returns null when nothing matched; the caller decides whether to mark
// the venue unresolved or escalate to geo.
export function resolveWardText(
  rawDistrict: string | null | undefined,
  wards: NormalizableWard[],
): ResolveResult | null {
  if (!rawDistrict || wards.length === 0) return null;
  const raw = normalize(rawDistrict);
  if (!raw) return null;

  // Stage 1: exact canonical-name match. Unambiguous; covers ~60% of rows
  // already labelled with the new post-2025 ward name.
  for (const w of wards) {
    if (w.nameNorm === raw) {
      return { wardCanonical: w.name, wardType: w.type, method: 'exact' };
    }
  }

  // Stage 2a: alias match on the whole string. If exactly one ward claims
  // this string as an alias we're done. Multiple matches are deterministic
  // — pick the first (which is the most-central ward thanks to seed order)
  // but flag via matchedVia so admin can re-resolve with geo later.
  const aliasExact = wards.filter((w) => w.aliasesNorm.includes(raw));
  if (aliasExact.length === 1) {
    return {
      wardCanonical: aliasExact[0].name,
      wardType: aliasExact[0].type,
      method: 'alias',
      matchedVia: rawDistrict,
    };
  }
  if (aliasExact.length > 1) {
    return {
      wardCanonical: aliasExact[0].name,
      wardType: aliasExact[0].type,
      method: 'alias',
      matchedVia: `ambiguous(${aliasExact.length}):${rawDistrict}`,
    };
  }

  // Stage 2b: token-level match. Catches multi-part raw strings:
  //   "Đông Sơn, Nội Bài"  → token "Nội Bài" hits the ward NAME
  //   "Phường 6, Quận 3"   → token "Quận 3" hits an alias of "Bàn Cờ"
  //   "Xuân Trường - Đà Lạt" → token "Xuân Trường" hits a name
  for (const token of splitToTokens(rawDistrict)) {
    const tn = normalize(token);
    if (!tn) continue;
    // Prefer NAME hit — more specific than an alias hit.
    const nameHit = wards.filter((w) => w.nameNorm === tn);
    if (nameHit.length >= 1) {
      return {
        wardCanonical: nameHit[0].name,
        wardType: nameHit[0].type,
        method: 'exact',
        matchedVia: `token-name:${token}`,
      };
    }
    const aliasHit = wards.filter((w) => w.aliasesNorm.includes(tn));
    if (aliasHit.length >= 1) {
      return {
        wardCanonical: aliasHit[0].name,
        wardType: aliasHit[0].type,
        method: 'alias',
        matchedVia: aliasHit.length > 1 ? `token-ambiguous:${token}` : `token:${token}`,
      };
    }
  }

  return null;
}

// Same matching pipeline as resolveWardText but takes BOTH the raw
// district AND the full scraped address — the address often contains
// the ward name as a comma-separated segment when the scraper's district
// extraction failed. Example for HCM:
//
//   district:  "Hồ Chí Minh"             (generic, useless)
//   address:   "187 Phạm Ngũ Lão, Bến Thành, Hồ Chí Minh, Việt Nam"
//
// Splitting on commas and trying each token catches "Bến Thành" directly.
// Tries district first (cheaper, fewer false positives) then falls back
// to address tokens. The address tokens skip the FIRST segment (always a
// street/building, never a ward) and the LAST 1-2 segments (always city +
// country) to avoid matching "Hồ Chí Minh" as a fake alias hit.
export function resolveWardFromVenue(
  rawDistrict: string | null | undefined,
  address: string | null | undefined,
  wards: NormalizableWard[],
): ResolveResult | null {
  const fromDistrict = resolveWardText(rawDistrict, wards);
  if (fromDistrict) return fromDistrict;
  if (!address) return null;

  // Drop the LAST 1-2 segments (city + country) — those are reliably the
  // tail of every address. Then walk what remains looking for a ward hit.
  //
  // Originally this also dropped parts[0] assuming it was a street/building
  // number. That breaks when the address starts with the ward itself —
  // PISO returns rows like "Thuận Hóa, Tp. Huế, Huế, Việt Nam" where index
  // 0 IS the ward. Instead of dropping index 0 unconditionally, just skip
  // any segment that LOOKS like a street: starts with a digit, contains
  // "/", or has an explicit street-type prefix. resolveWardText also runs
  // a name-then-alias match internally, so unknown segments produce no
  // false positives.
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const lastWard = parts.length - (parts[parts.length - 1].toLowerCase().includes('việt')
    || parts[parts.length - 1].toLowerCase().includes('vietnam') ? 2 : 1);
  const candidates = parts.slice(0, lastWard);

  const looksLikeStreet = (s: string): boolean => {
    if (/^\d/.test(s)) return true;                        // "16 Chu Văn An"
    if (s.includes('/')) return true;                       // "K280/23 Hoàng Diệu"
    if (/^(đường|phố|hẻm|ngõ|ngách|tổ|đ\.|p\.|kp)\s/i.test(s)) return true;
    return false;
  };

  for (const candidate of candidates) {
    if (looksLikeStreet(candidate)) continue;
    const r = resolveWardText(candidate, wards);
    if (r) return { ...r, method: r.method, matchedVia: `address:${candidate}` };
  }
  return null;
}

