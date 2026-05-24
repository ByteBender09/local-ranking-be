# location-ranking-be

NestJS + TypeORM + PostgreSQL backend for the **Homnaydidau** location-ranking app.

## Stack

- **NestJS 11** — modular HTTP server
- **TypeORM 0.3** — repositories on top of Postgres
- **PostgreSQL** — primary store
- **Passport** — JWT, Google OAuth 2.0, Instagram Basic Display
- **class-validator** — DTO validation
- **Helmet + compression + ThrottlerGuard** — security & performance defaults
- **cache-manager** — in-memory cache for hot read endpoints

## Architecture

```
src/
├── main.ts                      # bootstrap (helmet, compression, CORS, validation)
├── app.module.ts                # root composition
├── config/                      # env validation + typed configuration
├── common/                      # filters, interceptors, decorators, shared DTOs
├── database/
│   ├── data-source.ts           # standalone DataSource for CLI / seed
│   ├── database.module.ts       # async TypeOrmModule wiring
│   ├── entities/                # all entities live in one place to avoid cycles
│   └── seed.ts                  # idempotent seed script
└── modules/
    ├── auth/                    # Google OAuth + Instagram link flow, JWT issue/verify
    ├── cities/
    ├── venues/                  # list / search / trending / by slug
    ├── users/                   # public profile + me (PATCH)
    ├── reviews/                 # list per venue, upsert/delete own review
    ├── votes/                   # transactional toggle with counter sync
    ├── check-ins/               # check-in + memory updates
    ├── journey/                 # save / unsave / seed bookmarks
    ├── tours/                   # third-party tours by city + category
    └── discover/                # trending, recently liked, editor's pick, hidden gems, for-me
```

Each feature module owns its DTOs, service, controller and (when needed) a thin repository.
Entities are centralized in `database/entities` so all modules share the same identity.

## Setup

```bash
cp .env.example .env            # set DATABASE_URL, JWT_SECRET, OAuth creds
npm install
createdb location_ranking       # or any managed Postgres (Supabase, Neon, RDS…)
npm run seed                    # creates schema (synchronize) + populates demo data
npm run start:dev               # API on http://localhost:4000
```

The database is configured with a single `DATABASE_URL` connection string:

```
postgres://user:password@host:port/database?sslmode=require
```

Set `DB_SSL=true` when the provider requires TLS (Supabase, Neon, RDS, etc.).

For real Google login, create an OAuth 2.0 Client in Google Cloud Console with
redirect URI `http://localhost:4000/auth/google/callback`.

For Instagram linking, create a Facebook App with the **Instagram Basic Display**
product, add `http://localhost:4000/auth/instagram/callback` as a valid OAuth
redirect URI, and put the credentials in `.env`.

## Auth flow

1. Frontend redirects user to `GET /auth/google` → Google consent → callback.
2. Backend creates/updates a user, signs a JWT, redirects to
   `GOOGLE_SUCCESS_REDIRECT?token=<jwt>`.
3. Frontend stores the token and sends `Authorization: Bearer <jwt>` on every
   protected call.
4. To link Instagram, frontend calls `POST /auth/instagram/token` to mint a
   short-lived link token, then redirects to
   `GET /auth/instagram?token=<link-token>`. After consent we save the
   Instagram username + access token on the user.

## Key endpoints

| Method | Path                                     | Auth | Purpose                      |
| ------ | ---------------------------------------- | ---- | ---------------------------- |
| GET    | `/health`                            | –    | liveness                     |
| GET    | `/cities`                            | –    | list cities                  |
| GET    | `/cities/:slug`                      | –    | city by slug                 |
| GET    | `/venues?citySlug=&category=&sort=`  | –    | paginated venues             |
| GET    | `/venues/trending?limit=`            | –    | hot list                     |
| GET    | `/venues/search?q=&limit=`           | –    | name/district/address search |
| GET    | `/venues/:slug`                      | –    | venue detail                 |
| GET    | `/venues/:venueId/reviews`           | –    | reviews for a venue          |
| PUT    | `/venues/slug/:slug/reviews/me`      | JWT  | upsert own review            |
| DELETE | `/venues/slug/:slug/reviews/me`      | JWT  | remove own review            |
| POST   | `/venues/slug/:slug/vote`            | JWT  | toggle upvote/downvote       |
| GET    | `/me/votes`                          | JWT  | current votes                |
| POST   | `/venues/slug/:slug/check-in`        | JWT  | check in                     |
| PATCH  | `/venues/slug/:slug/check-in/memory` | JWT  | update memory                |
| DELETE | `/venues/slug/:slug/check-in`        | JWT  | remove check-in              |
| GET    | `/me/check-ins`                      | JWT  | own check-ins                |
| GET    | `/me/journey`                        | JWT  | bookmarked venues            |
| POST   | `/me/journey/:slug`                  | JWT  | add bookmark                 |
| DELETE | `/me/journey/:slug`                  | JWT  | remove bookmark              |
| POST   | `/me/journey/seed`                   | JWT  | bulk add by venueIds         |
| GET    | `/users/leaderboard?limit=`          | –    | top check-in users           |
| GET    | `/users/bookable?limit=`             | –    | bookable creators            |
| GET    | `/users/me`                          | JWT  | own profile                  |
| PATCH  | `/users/me`                          | JWT  | update profile / socials     |
| GET    | `/users/:handle`                     | –    | public profile               |
| GET    | `/tours?citySlug=&category=&limit=`  | –    | tours catalog                |
| GET    | `/tours/:slug`                       | –    | tour detail                  |
| GET    | `/discover/trending`                 | –    | discover feed                |
| GET    | `/discover/recently-liked`           | –    |                              |
| GET    | `/discover/editors-pick`             | –    |                              |
| GET    | `/discover/hidden-gems`              | –    |                              |
| GET    | `/discover/for-me`                   | JWT  | personalised picks           |
| GET    | `/auth/google`                       | –    | start Google OAuth           |
| GET    | `/auth/google/callback`              | –    | OAuth callback               |
| POST   | `/auth/instagram/token`              | JWT  | issue Instagram link token   |
| GET    | `/auth/instagram?token=`             | –    | start Instagram OAuth        |
| GET    | `/auth/instagram/callback`           | –    | OAuth callback               |
| POST   | `/auth/instagram/unlink`             | JWT  | unlink Instagram             |

## Defense in depth

The application layer ships with these protections enabled by default:

| Layer               | Protection                                                                                                                                   | Where                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Network identity    | `app.set('trust proxy', TRUST_PROXY)` so `req.ip` resolves to the real client IP behind a load balancer / CDN                                | `main.ts`                                                                    |
| Headers             | Helmet (HSTS, XFO, no-sniff, referrer policy, …)                                                                                             | `main.ts`                                                                    |
| Compression         | gzip/deflate response compression                                                                                                            | `main.ts`                                                                    |
| Payload size        | Express `json` / `urlencoded` body limit (`BODY_LIMIT`, default `1mb`)                                                                       | `main.ts`                                                                    |
| Slow requests       | Per-request socket timeout (15s) to mitigate Slowloris                                                                                       | `main.ts`                                                                    |
| CORS                | Strict allow-list (`CORS_ORIGINS`), no wildcard, no credentials leak                                                                         | `main.ts`                                                                    |
| Rate limit (global) | `IpThrottlerGuard` with three tiers per client IP: short burst (20 req/s), default sustained (120 req/min), auth (10 req/min on `/auth/*`)   | `app.module.ts`, `common/guards/ip-throttler.guard.ts`                       |
| Rate limit (route)  | `@Throttle` on `AuthController` to brake brute-force OAuth replay; `@SkipThrottle` on `/health` so probes don't burn quota                   | `modules/auth/auth.controller.ts`, `common/controllers/health.controller.ts` |
| Input validation    | Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`; max-length / range / array-size checks on every DTO           | `main.ts`, every `dto/` folder                                               |
| Auth                | JWT verified on every non-`@Public` route via global `JwtAuthGuard`; short-lived (10 min) link tokens for the Instagram OAuth state hand-off | `modules/auth`                                                               |
| DB exhaustion       | Connection pool capped (`DB_POOL_SIZE`), `statement_timeout` 10s, `idle_in_transaction_session_timeout` 10s, `connectionTimeoutMillis` 5s    | `database/database.module.ts`                                                |
| Process             | `app.enableShutdownHooks()` for graceful drain on SIGTERM, Nest retry on DB connect                                                          | `main.ts`, `database/database.module.ts`                                     |

### What is NOT — and should not be — handled in the app

Real DDoS absorption and load balancing belong **in front** of the Node
process, never inside it:

- **Load balancer** — AWS ALB / NLB, GCP HTTPS LB, nginx, HAProxy, Caddy. Set
  `TRUST_PROXY` to the hop count so the throttler sees the real client IP.
- **L7 DDoS / WAF** — Cloudflare, AWS WAF, Fastly. They absorb SYN floods,
  HTTP floods, slowloris at scale, and apply bot / geo / managed rule sets
  before traffic ever hits this service.
- **CDN** — cache the public read endpoints (`/cities`, `/venues`,
  `/discover/*`) at the edge. They are already cache-friendly (no `Set-Cookie`,
  deterministic responses) — add `Cache-Control` headers via an interceptor if
  you want browser caching too.
- **Horizontal scaling** — this service is stateless (JWT + Postgres). Run N
  replicas behind the LB. Replace the in-memory `cache-manager` store with
  Redis when you do, so cache and throttle counters are shared across pods.
- **Database HA** — read replicas + connection pooler (PgBouncer / RDS Proxy)
  when traffic grows.

## Performance notes

- Postgres connection pool sized via `DB_POOL_SIZE` (default 20); statement
  timeout 10s, idle-in-transaction 10s.
- Hot endpoints (`/cities`, `/discover/*`) cached in-memory with short TTLs;
  swap `cache-manager` for Redis in production via the standard NestJS adapter.
- Vote/review/check-in mutations run in a single transaction and keep the
  denormalised counters (`venues.upvotes`, `venues.rating`, `venues.review_count`,
  `users.check_in_count`) consistent.
- Composite indexes on `(city_id, category)`, `upvotes DESC`, `rating DESC`,
  `(user_id, created_at)` for the common access patterns.
- Global `ThrottlerGuard` protects against accidental floods; tune per-route
  with `@Throttle` decorators when needed.
- Global `ValidationPipe` with `whitelist`, `transform`, and
  `forbidNonWhitelisted` rejects unexpected payloads before they reach handlers.
- Schema changes should ship as TypeORM migrations
  (`npm run migration:generate -- src/database/migrations/<Name>`); only `seed`
  uses `synchronize: true`.
