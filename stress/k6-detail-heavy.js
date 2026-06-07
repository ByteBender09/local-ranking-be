import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Detail-page stress — simulates SSR fan-out a single venue/profile page
// fires per render. Each iteration is ONE simulated page view.
//
// Run: k6 run -e BASE_URL=http://localhost:4000 -e VUS=200 -e SLUGS=biet-thu-hang-nga-crazy-house-da-lat,quan-hoa-moc-lan-cafe-ho-chi-minh stress/k6-detail-heavy.js

const BASE = __ENV.BASE_URL || 'http://localhost:4000';
const VUS = parseInt(__ENV.VUS || '100', 10);
const DURATION = __ENV.DURATION || '90s';
const SLUGS = (__ENV.SLUGS || 'biet-thu-hang-nga-crazy-house-da-lat').split(',');

const ttfb = new Trend('ttfb');
const errors = new Rate('errors');

export const options = {
  scenarios: {
    detail: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: VUS },
        { duration: DURATION, target: VUS },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.03'],
  },
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function get(path) {
  const res = http.get(`${BASE}${path}`);
  ttfb.add(res.timings.waiting);
  const ok = check(res, {
    'status 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });
  if (!ok) errors.add(1);
  return res;
}

export default function () {
  const slug = pick(SLUGS);
  const venue = get(`/venues/${slug}`);
  let venueId = null;
  try {
    const body = JSON.parse(venue.body);
    venueId = body?.data?.id;
  } catch {}
  if (venueId) {
    get(`/venues/${venueId}/reviews`);
    get(`/tours?venueId=${venueId}`);
  }
  sleep(Math.random() * 3 + 2);
}
