import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Mixed-traffic stress test.
// Run:    k6 run -e BASE_URL=http://localhost:4000 -e VUS=600 stress/k6-mixed.js
// Quick:  k6 run -e BASE_URL=http://localhost:4000 -e VUS=50 -e DURATION=30s stress/k6-mixed.js
//
// Ramps up to VUS users across ~60s, holds for DURATION, then ramps down.
// Mirrors a public read mix: 70% listing/discover, 20% detail, 10% search.

const BASE = __ENV.BASE_URL || 'http://localhost:4000';
const VUS = parseInt(__ENV.VUS || '300', 10);
const DURATION = __ENV.DURATION || '2m';

const ttfb = new Trend('ttfb');
const errors = new Rate('errors');

export const options = {
  scenarios: {
    mixed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.floor(VUS / 2) },
        { duration: '30s', target: VUS },
        { duration: DURATION, target: VUS },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    errors: ['rate<0.03'],
  },
};

const CITIES = ['ho-chi-minh', 'ha-noi', 'da-nang', 'da-lat', 'nha-trang'];
const SEARCH_TERMS = ['cafe', 'pho', 'beach', 'view', 'park', 'sea food'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function get(path) {
  const res = http.get(`${BASE}${path}`, {
    tags: { route: path.replace(/\?.*$/, '').replace(/[0-9a-f-]{8,}/g, ':id') },
  });
  ttfb.add(res.timings.waiting);
  const ok = check(res, {
    'status 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });
  if (!ok) errors.add(1);
  return res;
}

export default function () {
  const roll = Math.random();
  if (roll < 0.25) {
    get('/cities');
  } else if (roll < 0.45) {
    get('/discover/trending?limit=8');
  } else if (roll < 0.6) {
    get(`/venues?citySlug=${pick(CITIES)}&limit=24`);
  } else if (roll < 0.75) {
    get('/discover/recently-liked?limit=8');
  } else if (roll < 0.85) {
    get(`/cities/${pick(CITIES)}`);
  } else if (roll < 0.95) {
    get(`/venues/search?q=${encodeURIComponent(pick(SEARCH_TERMS))}&limit=8`);
  } else {
    get('/users/leaderboard?limit=50');
  }
  sleep(Math.random() * 2 + 1);
}
