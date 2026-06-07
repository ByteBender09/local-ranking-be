import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Polite single-source test. Caps RPS at ~3 to stay under the per-IP
// throttler (240/min default) so we measure pure latency, not 429 rejects.
// Use this to validate cache hit-rate after deploying PublicCache changes.

const BASE = __ENV.BASE_URL || 'http://localhost:4000';
const DURATION = __ENV.DURATION || '60s';

const ttfb = new Trend('ttfb');
const errors = new Rate('errors');

export const options = {
  scenarios: {
    polite: {
      executor: 'constant-arrival-rate',
      rate: 3,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

const CITIES = ['ho-chi-minh', 'ha-noi', 'da-nang', 'da-lat', 'nha-trang'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function get(path) {
  const res = http.get(`${BASE}${path}`, {
    tags: { name: path.replace(/[?&].*$/, '').replace(/[0-9a-f-]{8,}/g, ':id') },
  });
  ttfb.add(res.timings.waiting);
  const ok = check(res, {
    'status 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });
  if (!ok) errors.add(1);
}

export default function () {
  const roll = Math.random();
  if (roll < 0.3) get('/cities');
  else if (roll < 0.55) get('/discover/trending?limit=8');
  else if (roll < 0.75) get(`/venues?citySlug=${pick(CITIES)}&limit=24`);
  else if (roll < 0.9) get(`/cities/${pick(CITIES)}`);
  else get('/users/leaderboard?limit=50');
}
