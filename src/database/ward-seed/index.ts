import type { DestinationSeed } from './types';
import hoChiMinh from './ho-chi-minh';
import haNoi from './ha-noi';
import daNang from './da-nang';
import hoiAn from './hoi-an';
import hue from './hue';
import daLat from './da-lat';
import nhaTrang from './nha-trang';
import ninhBinh from './ninh-binh';
import saPa from './sa-pa';
import quangNinh from './quang-ninh';
import vungTau from './vung-tau';
import phuQuoc from './phu-quoc';

// All 12 tourism destinations in one place — order doesn't matter.
// `seed-wards.ts` iterates this and upserts each city's wards.
export const ALL_DESTINATION_SEEDS: DestinationSeed[] = [
  hoChiMinh,
  haNoi,
  daNang,
  hoiAn,
  hue,
  daLat,
  nhaTrang,
  ninhBinh,
  saPa,
  quangNinh,
  vungTau,
  phuQuoc,
];

export type { DestinationSeed, WardSeed } from './types';
