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
cp .env.example .env            # fill DB and OAuth credentials
npm install
createdb location_ranking       # or use any Postgres provisioning method
npm run seed                    # creates schema (synchronize) + populates demo data
npm run start:dev               # API on http://localhost:4000/api
```

For real Google login, create an OAuth 2.0 Client in Google Cloud Console with
redirect URI `http://localhost:4000/api/auth/google/callback`.

For Instagram linking, create a Facebook App with the **Instagram Basic Display**
product, add `http://localhost:4000/api/auth/instagram/callback` as a valid OAuth
redirect URI, and put the credentials in `.env`.

## Auth flow

1. Frontend redirects user to `GET /api/auth/google` → Google consent → callback.
2. Backend creates/updates a user, signs a JWT, redirects to
   `GOOGLE_SUCCESS_REDIRECT?token=<jwt>`.
3. Frontend stores the token and sends `Authorization: Bearer <jwt>` on every
   protected call.
4. To link Instagram, frontend calls `POST /api/auth/instagram/token` to mint a
   short-lived link token, then redirects to
   `GET /api/auth/instagram?token=<link-token>`. After consent we save the
   Instagram username + access token on the user.

## Key endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET    | `/api/health`                              | – | liveness |
| GET    | `/api/cities`                              | – | list cities |
| GET    | `/api/cities/:slug`                        | – | city by slug |
| GET    | `/api/venues?citySlug=&category=&sort=`    | – | paginated venues |
| GET    | `/api/venues/trending?limit=`              | – | hot list |
| GET    | `/api/venues/search?q=&limit=`             | – | name/district/address search |
| GET    | `/api/venues/:slug`                        | – | venue detail |
| GET    | `/api/venues/:venueId/reviews`             | – | reviews for a venue |
| PUT    | `/api/venues/slug/:slug/reviews/me`        | JWT | upsert own review |
| DELETE | `/api/venues/slug/:slug/reviews/me`        | JWT | remove own review |
| POST   | `/api/venues/slug/:slug/vote`              | JWT | toggle upvote/downvote |
| GET    | `/api/me/votes`                            | JWT | current votes |
| POST   | `/api/venues/slug/:slug/check-in`          | JWT | check in |
| PATCH  | `/api/venues/slug/:slug/check-in/memory`   | JWT | update memory |
| DELETE | `/api/venues/slug/:slug/check-in`          | JWT | remove check-in |
| GET    | `/api/me/check-ins`                        | JWT | own check-ins |
| GET    | `/api/me/journey`                          | JWT | bookmarked venues |
| POST   | `/api/me/journey/:slug`                    | JWT | add bookmark |
| DELETE | `/api/me/journey/:slug`                    | JWT | remove bookmark |
| POST   | `/api/me/journey/seed`                     | JWT | bulk add by venueIds |
| GET    | `/api/users/leaderboard?limit=`            | – | top check-in users |
| GET    | `/api/users/bookable?limit=`               | – | bookable creators |
| GET    | `/api/users/me`                            | JWT | own profile |
| PATCH  | `/api/users/me`                            | JWT | update profile / socials |
| GET    | `/api/users/:handle`                       | – | public profile |
| GET    | `/api/tours?citySlug=&category=&limit=`    | – | tours catalog |
| GET    | `/api/tours/:slug`                         | – | tour detail |
| GET    | `/api/discover/trending`                   | – | discover feed |
| GET    | `/api/discover/recently-liked`             | – | |
| GET    | `/api/discover/editors-pick`               | – | |
| GET    | `/api/discover/hidden-gems`                | – | |
| GET    | `/api/discover/for-me`                     | JWT | personalised picks |
| GET    | `/api/auth/google`                         | – | start Google OAuth |
| GET    | `/api/auth/google/callback`                | – | OAuth callback |
| POST   | `/api/auth/instagram/token`                | JWT | issue Instagram link token |
| GET    | `/api/auth/instagram?token=`               | – | start Instagram OAuth |
| GET    | `/api/auth/instagram/callback`             | – | OAuth callback |
| POST   | `/api/auth/instagram/unlink`               | JWT | unlink Instagram |

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
