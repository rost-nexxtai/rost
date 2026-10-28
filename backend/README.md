# Rost backend (Go)

The Go API behind the web app in `frontend/`, for the product described in [Architecture.md](../Architecture.md).

## Run with Docker (from the repo root)

```bash
cp .env.example .env
docker compose up -d --build
curl localhost:8080/readyz
```

This starts Postgres 16 (`db`, port 5432), the API (`backend`, port 8080) and the web app (`frontend`, port 3000). The API waits for the database to be healthy, then applies `internal/store/migrations/*.sql` (once each), seeds the demo persona and, the first time only, the content (`internal/content/seed`). Locally, `docker-compose.override.yml` publishes the ports and turns the demo tools on; in production (Dokploy, see the root README) they stay off unless `ALLOW_DEMO_TOKEN=true`.

To get an admin account, add these to the root `.env` before `docker compose up` (it's gitignored):

```bash
ADMIN_EMAIL=you@rost.ro
ADMIN_PASSWORD=at-least-12-characters
```

## Run locally

```bash
docker compose up -d db
cd backend
DATABASE_URL='postgres://rost:rost@localhost:5432/rost?sslmode=disable' ALLOW_DEMO_TOKEN=true \
  ADMIN_EMAIL=you@rost.ro ADMIN_PASSWORD='at-least-12-characters' go run ./cmd/api
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres connection string |
| `HTTP_ADDR` | `:8080` | Listen address |
| `SHUTDOWN_TIMEOUT` | `10s` | Time in-flight requests get on SIGTERM |
| `ALLOW_DEMO_TOKEN` | off | `true` turns on the stage helpers: demo partner token, app clock, demo reset. Keep it off in production |
| `PARTNER_DEMO_SECRET` | dev secret when demo tools are on | Secret the demo partner bank signs tokens with. Real partners get their own variable, named in `partners.json` |
| `POSTBACK_SECRET` | empty | When set, referral postbacks must send it in `x-postback-secret`. Set it in production |
| `ANTHROPIC_API_KEY`, `PAYSLIP_MODEL` | empty | Optional payslip photo reading. Without them `/api/payslip/read` answers 501 |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | empty | Both or neither. Create the first admin on start when that email has no account yet. Changing them later does nothing; add more admins with `POST /api/admin/admins` |

## Endpoints

App routes are under `/api`; shapes are in `frontend/src/contract.ts`. The session is the `rost_uid` cookie.

| Route | Purpose |
| --- | --- |
| `GET /healthz`, `GET /readyz` | Liveness; readiness (Postgres answers a ping) |
| `POST /api/users` | Create a user (onboarding) or `{demo:"maria"}` (demo personas only); sets the session cookie |
| `DELETE /api/users`, `GET /api/me` | Sign out; the current user |
| `POST /api/events` | Fire an event: `salary_received`, `inflation_published`, `shock_scenario`, `raise`, `catch_up`, … |
| `POST /api/calendar` | Run today's computed triggers for the current user |
| `GET /api/today` | Everything the Today/Momente screen needs |
| `GET/POST /api/moments/{runId}` | Load a moment with its view; post a guess, an action or a dismiss |
| `GET/POST /api/followups` | Due 7-day checks; confirm or skip |
| `GET /api/options` | Neutral ranking of savings options |
| `GET /api/providers`, `GET /api/providers/{assetId}` | Real banks and brokers per asset, ranked: savings by rate after tax, brokers by the cost of a 1,000 lei order. Each has its official site, the month checked and the source. No partners among them |
| `POST /api/referrals/clicks`, `GET /api/referrals/{clickId}` | Record a referral click; read it back for the mock bank |
| `POST /api/referrals/postback` | Partner reports `opened` or `funded` |
| `GET /api/partner/demo-token`, `GET /api/embed?token=` | Demo partner token; the partner view's data |
| `GET /api/metrics` | Aggregates only |
| `POST /api/payslip/read` | Optional payslip photo reader (multipart field `image`); the image is not stored |
| `GET/POST /api/clock`, `POST /api/demo/reset` | Demo tools: move the app clock; reset the demo personas |
| `GET /api/quiz`, `POST /api/quiz` | Quiz questions (without answers); score the quiz on the server and store the profile. Creates the user when there is no session |
| `GET /api/library`, `GET /api/library/{id}` | Published library moments, with steps |
| `POST /api/library/{id}/complete` | The user finished a library moment (optional `answers`: `picked`, `value` or `buckets` per graded step); returns the profile, `passed` and `levelUp`. Only a passed attempt (2 of 3 graded right) counts toward the level; the best attempt is kept |
| `GET /api/momente`, `GET /api/stiri` | The Momente and Știri screens. 404 `no profile` before the quiz |
| `POST /api/track` | Usage events for statistics (names in `app.ClientEvents`) |

`GET /api/me` also returns `profile` (level, risk profile, finished moments) once the user took the quiz.

### Admin

Admin routes are under `/api/admin` and need the `rost_admin` cookie from the login. It is HttpOnly, SameSite=Strict and scoped to `/api/admin`; sessions last 12 hours and end on logout.

| Route | Purpose |
| --- | --- |
| `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me` | Sign in (5 failures per email lock it for 15 minutes), sign out, who am I |
| `GET/POST /api/admin/admins` | List admins; add one (`{email, password}`, password 12+ characters) |
| `GET/POST /api/admin/content/{kind}` | `kind` is `moments` or `news`. List all, drafts included; create `{status, position?, doc}` |
| `GET/PUT/DELETE /api/admin/content/{kind}/{id}` | Read, replace (publish = `status: "published"`), delete |
| `GET /api/admin/stats?days=30` | Usage statistics for the last 1–365 days. Aggregates only |

Content is validated before it's stored: the shapes are `LibraryMoment` and `NewsItem` in `frontend/src/data/types.ts`. Unknown fields are rejected, a moment is at most 5 minutes, and links must be app paths (`/...`) or `https://`. A written lesson follows the same rules as `components/lesson/lessons.test.ts`: at most 7 steps, the last one `finish`, at least 2 graded steps (`choice`, `predict`, `sort`) and 2 takeaways, and a predict slider that doesn't start next to the answer. A moment with no steps is listed as "în curând". Ids can't change, because finished moments and links point to them.

Answers sent with a completion are graded like in the app: a choice by index, a predict when it's close (within a step or a tenth of the scale), a sort when every item is in the right bucket.

### Levels

The quiz has 4 questions in two tiers: the basics, then L1 concepts. A tier passes only when both its questions are right, tiers pass in order, and the level is the number of tiers passed (`learning.PlaceLevel`; onboarding skips the harder pair when the basics fail, `learning.AskTier`). The reasoning is in [docs/level-assessment.md](../docs/level-assessment.md). A lesson counts only when passed: at least 2 of 3 graded screens right (`learning.Passed`). The risk profile follows the level (L0 prudent, L1 echilibrat, L2 dinamic) with the horizon, buffer and debt caps; age adds nothing. The frontend mirrors these in `src/data/mock/scoring.ts`, and both test suites run the cases in `internal/learning/testdata/placement.json`.

A user's level is the highest of: the quiz level, the level their passed core moments earn, and the highest level they reached before. Only core moments that have steps count, so a lesson that isn't written yet doesn't block anyone. Publishing a new core lesson never moves anyone down.

### Tracking

The app sends what the user does (`page_view`, `moment_open`, `asset_view`, …) to `POST /api/track`; the API writes `user_created`, `quiz_completed`, `library_completed` and `level_up` itself when it sees them happen. Props are flat values only, and query strings are dropped from paths, so tokens and free-form data don't end up in the table. Statistics show aggregates, never a single user.

## Layout

```
cmd/api/              entry point: config, database, migrations, HTTP server, graceful shutdown
internal/config/      settings from the environment
internal/database/    pgx connection pool
internal/domain/      runtime records (users, events, runs, actions, referrals) and content, profile, tracking, admin types
internal/rules/       pure money rules for 2026: payslip, inflation, ranking of offers and brokers, dates
internal/reference/   versioned reference data in data/: moments, inflation, offers (real banks and state bonds), brokers, partners (demo only), scenarios, demo persona
internal/moments/     the engine that decides which moment an event opens
internal/views/       the numbers a moment shows one user
internal/app/         services (events, moments, follow-ups, referrals, quiz, library, tracking, admin), calendar, metrics, stats
internal/auth/        admin passwords (PBKDF2-SHA256), session tokens, login rate limit
internal/content/     validation for admin-edited content; the first content seed in seed/
internal/learning/    pure rules: quiz level, risk profile, level from moments, Momente and Știri order
internal/partner/     HS256 token a bank signs to open the partner view
internal/store/       Store interface, Postgres implementation, migrations
internal/server/      routes and handlers
```

## Checks

```bash
go vet ./... && go test ./...
# Postgres store test against a real database:
ROST_TEST_DATABASE_URL='postgres://rost:rost@localhost:5432/rost?sslmode=disable' go test ./internal/store/
```

Known limits:

- The personal tax deduction is not applied yet (`rules.PersonalDeductionImplemented = false`), so tax shown for lower salaries is slightly high.
- Statistics are computed in Go from the rows of the period, which is fine for a hackathon's volume. Move them to SQL aggregates before real traffic.
- The login rate limit is kept in memory, per instance.
