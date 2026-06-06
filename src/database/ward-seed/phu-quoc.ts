import type { DestinationSeed } from './types';

// Phú Quốc after July 2025: became a single đặc khu of the new An Giang
// province (after Kiên Giang + An Giang merger). The old huyện Phú Quốc
// with its 8 communes is now one administrative unit. For tourism search,
// we still want to filter by area within the island, so we model the
// pre-reform commune names as ALIAS-only wards (no separate canonical ward
// row) — but since users browse "Phú Quốc" as a whole and venues are
// distributed across the island, we keep a single canonical "Phú Quốc"
// đặc khu plus tag-style sub-area aliases for UX.
const seed: DestinationSeed = {
  citySlug: 'phu-quoc',
  wards: [
    {
      name: 'Phú Quốc',
      type: 'dac_khu',
      aliasesOldDistrict: ['Phú Quốc', 'Huyện Phú Quốc', 'TP Phú Quốc', 'Đảo Ngọc'],
      aliasesOldWards: [
        'Dương Đông', 'An Thới', 'Gành Dầu', 'Cửa Dương', 'Dương Tơ',
        'Cửa Cạn', 'Hàm Ninh', 'Bãi Thơm', 'Thổ Châu',
        'Đường Bào', 'Khu 1', 'Khu 2', 'Khu 6', 'Khu phố 1', 'Khu phố 5',
        'Khu phố 6', 'Bãi Trướng', 'Hamlet 4', 'Terza', 'Ấp Suối Lớn',
        'Ấp 7', 'Khu Địa Trung Hải', 'Bãi Khem', 'Bãi Nam', 'Ông Lang',
        'KP1', 'KP4', 'Suối Mây', 'Sunset Town', 'khu đô thị sun grannd city',
      ],
      aliasesUser: [
        'đảo Ngọc', 'Sun World Phú Quốc', 'Sunset Sanato', 'Bãi Sao',
        'Bãi Kem', 'Bãi Trường', 'Bãi Dài', 'Hòn Thơm', 'cáp treo Hòn Thơm',
        'chợ đêm Phú Quốc', 'phố đêm Phú Quốc', 'Vinpearl Phú Quốc', 'JW Marriott',
      ],
    },
    // Optional sub-areas — kept as separate wards so search can filter "north
    // Phú Quốc" vs "south Phú Quốc" when users ask. Current venue data tags
    // some with these granular names, so the normalizer will match.
    {
      name: 'Dương Đông',
      type: 'phuong',
      aliasesOldDistrict: ['Phú Quốc'],
      aliasesOldWards: ['Dương Đông', 'Khu phố 1', 'Khu phố 2', 'Khu phố 3'],
      aliasesUser: ['trung tâm Phú Quốc', 'phố đêm Dương Đông'],
    },
    {
      name: 'An Thới',
      type: 'phuong',
      aliasesOldDistrict: ['Phú Quốc'],
      aliasesOldWards: ['An Thới', 'Bãi Khem', 'Bãi Sao', 'Sunset Town'],
      aliasesUser: ['nam đảo', 'Sunset Town', 'JW Marriott', 'Sun World'],
    },
    {
      name: 'Gành Dầu',
      type: 'xa',
      aliasesOldDistrict: ['Phú Quốc'],
      aliasesOldWards: ['Gành Dầu', 'Vinpearl'],
      aliasesUser: ['VinWonders', 'Vinpearl Land', 'bắc đảo'],
    },
    {
      name: 'Cửa Dương',
      type: 'xa',
      aliasesOldDistrict: ['Phú Quốc'],
      aliasesOldWards: ['Cửa Dương', 'Ông Lang'],
      aliasesUser: ['Ông Lang Beach'],
    },
    {
      name: 'Cửa Cạn',
      type: 'xa',
      aliasesOldDistrict: ['Phú Quốc'],
      aliasesOldWards: ['Cửa Cạn'],
      aliasesUser: ['suối Tranh', 'sông Cửa Cạn'],
    },
    {
      name: 'Dương Tơ',
      type: 'xa',
      aliasesOldDistrict: ['Phú Quốc'],
      aliasesOldWards: ['Dương Tơ', 'Bãi Trường'],
      aliasesUser: ['Bãi Trường', 'sân bay Phú Quốc'],
    },
    {
      name: 'Hàm Ninh',
      type: 'xa',
      aliasesOldDistrict: ['Phú Quốc'],
      aliasesOldWards: ['Hàm Ninh'],
      aliasesUser: ['làng chài Hàm Ninh'],
    },
  ],
};

export default seed;
