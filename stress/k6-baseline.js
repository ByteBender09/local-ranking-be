import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'https://api.homnaydidau.xyz';
const DURATION = __ENV.DURATION || '90s';

const ttfb = new Trend('ttfb');
const errors = new Rate('errors');

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 4,
      maxVUs: 10,
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
  if (roll < 0.2) get('/cities');
  else if (roll < 0.4) get('/discover/trending?limit=8');
  else if (roll < 0.6) get(`/venues?citySlug=${pick(CITIES)}&limit=24`);
  else if (roll < 0.8) get(`/cities/${pick(CITIES)}`);
  else get('/users/leaderboard?limit=50');
}
