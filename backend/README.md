# Rost backend (Go)

The Go API behind the web app in `frontend/`, for the product described in [Architecture.md](../Architecture.md).

## Run with Docker (from the repo root)

```bash
docker compose up -d --build
curl localhost:8080/readyz
```

This starts Postgres 16 (`db`, port 5432) and the API (`backend`, port 8080). The API waits for the database to be healthy, then applies `internal/store/migrations/*.sql` (once each) and seeds the demo persona. Compose turns the demo tools on.

## Run locally

```bash
docker compose up -d db
cd backend
DATABASE_URL='postgres://rost:rost@localhost:5432/rost?sslmode=disable' ALLOW_DEMO_TOKEN=true go run ./cmd/api
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
| `POST /api/referrals/clicks`, `GET /api/referrals/{clickId}` | Record a referral click; read it back for the mock bank |
| `POST /api/referrals/postback` | Partner reports `opened` or `funded` |
| `GET /api/partner/demo-token`, `GET /api/embed?token=` | Demo partner token; the partner view's data |
| `GET /api/metrics` | Aggregates only |
| `POST /api/payslip/read` | Optional payslip photo reader (multipart field `image`); the image is not stored |
| `GET/POST /api/clock`, `POST /api/demo/reset` | Demo tools: move the app clock; reset the demo personas |

## Layout

```
cmd/api/              entry point: config, database, migrations, HTTP server, graceful shutdown
internal/config/      settings from the environment
internal/database/    pgx connection pool
internal/domain/      runtime records (users, events, runs, actions, referrals)
internal/rules/       pure money rules for 2026: payslip, inflation, ranking, dates
internal/reference/   versioned reference data in data/: moments, inflation, offers, partners, scenarios, demo persona
internal/moments/     the engine that decides which moment an event opens
internal/views/       the numbers a moment shows one user
internal/app/         services (events, moments, follow-ups, referrals), calendar, metrics
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

Known limit: the personal tax deduction is not applied yet (`rules.PersonalDeductionImplemented = false`), so tax shown for lower salaries is slightly high.
