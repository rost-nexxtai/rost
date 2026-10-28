# Rost

Built for the Stripe NEXXT AI Hackathon, Bucharest 2026 ("Rethinking Financial Futures").

Rost helps Romanians understand their money. An onboarding quiz sets the user's financial-education level and risk profile, then the app shows instruments in priority order for that profile, with the real banks and brokers in Romania and a simulation that shows what inflation takes; short interactive lessons ("moments"); and news that affects their finances.

Kids accounts (games that lead a parent to a child's savings account) are part of the pitch only, not this build: see [MVP & business plan](MVP%20%26%20business%20plan.md#pitch-kids-accounts-not-built).

The product we are building is described in [Architecture.md](Architecture.md). The other documents ([Simple brief](Simple%20brief.md), [MVP & business plan](MVP%20%26%20business%20plan.md), [Young adults: Prima dată](Young%20adults%20Prima%20dat%C4%83.md)) cover the earlier hackathon MVP and the business case. That MVP's code is in git history up to commit `99b905c`.

> Education, not financial advice.

## Run it

```bash
docker compose up -d --build        # Postgres on :5432, Go API on :8080 (demo tools on)
curl localhost:8080/readyz
```

The API applies its migrations and seeds the demo persona (Maria) and the first content on start. For an admin account (content editing, statistics), set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in a root `.env` file first. See [backend/README.md](backend/README.md) for configuration, the admin API and local development without Docker.

The UI is a Next.js app. It covers the adult experience only so far; its design and plan are in [docs/superpowers](docs/superpowers). Run it with Node 20.12 or newer:

```bash
cd frontend
cp .env.example .env.local          # BACKEND_URL=http://localhost:8080
npm install
npm run dev                          # http://localhost:3000
```

Click **Continuă ca Maria (demo)**. The browser only talks to the Next.js app; it proxies `/api/*` to the Go API, so the session cookie stays first-party.

## Where the frontend gets its data

| Screen | Source today |
| --- | --- |
| Session, Maria login, triggered moments and the moment player, follow-ups, simulator, clock, calendar, partner view, referral click → mock bank → funded, metrics | **Go API** |
| Banks and brokers on asset pages and Acasă (real providers, rates checked monthly, links to their official sites) | **Go API** (`/api/providers`) |
| Quiz, level and risk profile, Acasă, asset text, Știri | Fixtures and mock logic in `frontend/src/data/` (each file names the endpoint that will replace it). The Go API now serves the quiz, profile, library, Momente, Știri and tracking (`/api/quiz`, `/api/me`, `/api/library`, `/api/momente`, `/api/stiri`, `/api/track`); the frontend doesn't call them yet |

Request and response shapes live in `frontend/src/contract.ts` and match the Go handlers' JSON tags in `backend/internal/server`.

## Layout

```
Architecture.md      target product: Home, Moments, News; levels L0–L2
backend/             Go API (net/http, pgx): rules engine, moment engine, Postgres store, referrals, partner tokens
frontend/            Next.js app, Romanian and English UI: quiz, Acasă, asset pages, Momente, Știri, demo tools
docs/                frontend design spec and implementation plan
docker-compose.yml   Postgres + Go API
```
