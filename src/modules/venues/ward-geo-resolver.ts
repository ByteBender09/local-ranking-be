// Stage 3 fallback: for venues whose raw district + address strings don't
// resolve to any seeded ward (~2% of the dataset), pick the nearest
// already-resolved venue in the same city and copy its ward.
//
// This is intentionally simpler than fetching OSM admin polygons. With the
// address-aware resolver covering 97.8% of rows already, the remaining
// holes are either (a) genuinely generic strings like "Hồ Chí Minh" with
// real lat/lng or (b) Plus Codes. For (a), the nearest already-tagged
// venue is overwhelmingly in the same ward — HCM's wards are ~1-3km
// across and venues cluster tightly. For (b) the points are still real
// coordinates so the same approach applies.
//
// Marked with method='geo' so admins can filter and double-check; if any
// turn out wrong the cleanup is just an edit on the raw `district` and a
// backfill re-run.

export interface AnchorPoint {
  wardCanonical: string;
  wardType: 'phuong' | 'xa' | 'dac_khu';
  lat: number;
  lng: number;
}

export interface GeoResult {
  wardCanonical: string;
  wardType: 'phuong' | 'xa' | 'dac_khu';
  method: 'geo';
  matchedVia: string;
}

// Haversine distance in km. Cheap enough for ~300 anchor points × 40
// unresolved venues per backfill; if anchors grow into the tens of
// thousands we'd want a kd-tree, but we're nowhere near that.
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Given a venue's lat/lng + a list of already-resolved anchor points in
// the same city, find the nearest anchor and return its ward. Returns null
// when there are no anchors (e.g. the city has only unresolved rows — a
// chicken-and-egg state we never expect in practice because Stage 1+2
// cover the bulk).
//
// `maxKm` guards against a wild outlier (venue mistakenly tagged to a city
// it isn't actually in) — if the nearest anchor is farther than this, we
// refuse to guess. 15km is generous enough to span every destination
// while still rejecting cross-city errors.
export function resolveByNearestAnchor(
  lat: number,
  lng: number,
  anchors: AnchorPoint[],
  maxKm = 15,
): GeoResult | null {
  if (!anchors.length) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null;
  }
  let best: AnchorPoint | null = null;
  let bestDist = Infinity;
  for (const a of anchors) {
    const d = distanceKm(lat, lng, a.lat, a.lng);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  if (!best || bestDist > maxKm) return null;
  return {
    wardCanonical: best.wardCanonical,
    wardType: best.wardType,
    method: 'geo',
    matchedVia: `nn:${bestDist.toFixed(2)}km`,
  };
}
