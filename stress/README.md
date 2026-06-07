# Stress tests

Two k6 scripts to validate the BE handles concurrent load without crashing.

## Install k6

```bash
choco install k6        # Windows
brew install k6         # macOS
```

## Scripts

### `k6-mixed.js`
Realistic 70/20/10 read mix (listing/discover/detail/search). Use this as the
"can we handle 600 users browsing" gate.

```bash
# Quick smoke (50 VUs, 30s)
k6 run -e BASE_URL=http://localhost:4000 -e VUS=50 -e DURATION=30s stress/k6-mixed.js

# Target 600 concurrent users for 2 min after a 60s ramp
k6 run -e BASE_URL=http://localhost:4000 -e VUS=600 stress/k6-mixed.js
```

### `k6-detail-heavy.js`
Hammers venue detail pages, which fan out 2-3 BE calls each. Catches N+1 +
uncached relation joins.

```bash
k6 run -e BASE_URL=http://localhost:4000 -e VUS=200 \
  -e SLUGS=biet-thu-hang-nga-crazy-house-da-lat,quan-hoa-moc-lan-cafe-ho-chi-minh \
  stress/k6-detail-heavy.js
```

## Thresholds (both scripts)

- `http_req_failed` < 3%
- `http_req_duration p95` < 1.5s (mixed) / 2s (detail)
- `http_req_duration p99` < 3s

k6 exits non-zero if any threshold breaches — wire into CI to gate deploys.

## Local target

Point at a local BE (`npm run start:dev` then BASE_URL=http://localhost:4000).
Do NOT point at production unless you've coordinated a maintenance window.

## Interpreting results

- **p95 latency rising** = DB pool exhaustion or CPU bottleneck. Check
  `pg_stat_activity` and Node process CPU.
- **errors rising > 3%** = throttler tripping (429), pool exhausted (timeout),
  or app crashed. Check BE logs.
- **TTFB high but throughput stable** = cache miss rate too high; revisit
  Cache-Control TTLs on hot endpoints.
