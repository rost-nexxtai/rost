# Rost

Built for the Stripe NEXXT AI Hackathon, Bucharest 2026 ("Rethinking Financial Futures").

Rost helps Romanians understand their money. An onboarding quiz sets the user's financial-education level and risk profile, then the app shows instruments in priority order for that profile, with the real banks and brokers in Romania and a simulation that shows what inflation takes; short interactive lessons ("moments"); and news that affects their finances.

Kids accounts (games that lead a parent to a child's savings account) are part of the pitch only, not this build: see [MVP & business plan](MVP%20%26%20business%20plan.md#pitch-kids-accounts-not-built).

The product we are building is described in [Architecture.md](Architecture.md). The other documents ([Simple brief](Simple%20brief.md), [MVP & business plan](MVP%20%26%20business%20plan.md), [Young adults: Prima dată](Young%20adults%20Prima%20dat%C4%83.md)) cover the earlier hackathon MVP and the business case. That MVP's code is in git history up to commit `99b905c`.

> Education, not financial advice.

## Run it

```bash
cp .env.example .env                # local values; add ADMIN_EMAIL and ADMIN_PASSWORD for an admin account
docker compose up -d --build        # web app on :3000, Go API on :8080, Postgres on :5432 (demo tools on)
curl localhost:8080/readyz
```

This runs the whole stack, the web app included, at http://localhost:3000 (set `FRONTEND_PORT` in `.env` if 3000 is taken). Locally, `docker-compose.override.yml` is merged in automatically: it publishes the ports and turns the demo tools on. The API applies its migrations and seeds the demo persona (Maria) and the first content on start. See [backend/README.md](backend/README.md) for configuration, the admin API and local development without Docker.

The UI is a Next.js app. It covers the adult experience only so far; its design and plan are in [docs/superpowers](docs/superpowers). To work on it with hot reload, run it outside Docker with Node 20.12 or newer:

```bash
cd frontend
cp .env.example .env.local          # BACKEND_URL=http://localhost:8080
npm install
npm run dev                          # http://localhost:3000
```

Click **Continuă ca Maria (demo)**. The browser only talks to the Next.js app; it proxies `/api/*` to the Go API, so the session cookie stays first-party.

## Deploy (Dokploy)

`docker-compose.yml` is the production stack. In Dokploy:

1. Create a **Docker Compose** service from this repository, with compose path `./docker-compose.yml`.
2. In **Environment**, set at least `POSTGRES_PASSWORD` (URL-safe, e.g. `openssl rand -hex 24`). Optional: `ADMIN_EMAIL` and `ADMIN_PASSWORD`, `POSTBACK_SECRET`, `ALLOW_DEMO_TOKEN=true` for a stage demo, `EMBED_FRAME_ANCESTORS` for the partner sites that may frame the bank view. `.env.example` lists them all.
3. In **Domains**, add your domain for service `frontend`, port `3000`, with HTTPS on, and set `HSTS=true` in **Environment**. Point the domain's DNS `A` record at the server.
4. Deploy. Use **Preview Compose** first to see the labels Dokploy adds.

Only the frontend is public. It reaches the API over the stack's internal network, and neither the API nor Postgres publishes a port. The database lives in the named volume `rost-db`, which Dokploy's Volume Backups can back up. Demo tools stay off unless you set `ALLOW_DEMO_TOKEN=true`.

Both images run as a non-root user and carry a Docker health check: the API answers `GET /healthz` (a tiny `healthcheck` binary, since the image has no shell), the web app serves its landing page. Every service restarts unless stopped, and the web app starts once the API is healthy.

The web app sends browser security headers on every page: `nosniff`, a short `Referrer-Policy`, a `Permissions-Policy` that turns off camera, microphone, location and the like, and no `X-Powered-By`. No site may frame it (`X-Frame-Options: DENY`, `frame-ancestors 'none'`) except the bank view `/embed`, which this site and the origins in `EMBED_FRAME_ANCESTORS` may frame. `Strict-Transport-Security` is sent only with `HSTS=true`. Like `BACKEND_URL`, both are read when the frontend image is built, so redeploy with a rebuild after changing them.

## Where the frontend gets its data

| Screen | Source today |
| --- | --- |
| Session, Maria login, triggered moments and the moment player, follow-ups, simulator, clock, calendar, partner view, referral click → mock bank → funded, metrics | **Go API** |
| Banks and brokers on asset pages and Acasă (real providers, rates checked monthly, links to their official sites) | **Go API** (`/api/providers`) |
| Quiz (scored on the server), level and risk profile, lessons finished and left halfway, the week's days, "Banii tăi", Știri | **Go API** (`/api/quiz`, `/api/me`, `/api/library/{id}/complete`, `/api/library/{id}/progress`, `/api/stiri`). The profile lives in Postgres, not in a browser cookie, so the app and the bank view read the same user |
| Payslip, with the personal deduction (art. 77: 20% of the minimum wage, down 0.5 points per 50 lei above it, +15% under 26) and the untaxed 200 lei at the minimum wage | **Go API** (`/api/payslip`, the payslip moment); reading the gross from a photo (`/api/payslip/read`) when `ANTHROPIC_API_KEY` and `PAYSLIP_MODEL` are set |
| Acasă cards and the Momente roadmap, asset text | Put together in `frontend/src/data/` from the backend's profile and lessons; asset text is a fixture |

Request and response shapes live in `frontend/src/contract.ts` and match the Go handlers' JSON tags in `backend/internal/server`.

## Layout

```
Architecture.md      target product: Home, Moments, News; levels L0–L2
backend/             Go API (net/http, pgx): rules engine, moment engine, Postgres store, referrals, partner tokens
frontend/            Next.js app, Romanian and English UI: quiz, Acasă, asset pages, Momente, Știri, demo tools
docs/                frontend design spec and implementation plan
docker-compose.yml   production stack (Postgres, Go API, web app), deployed with Dokploy
docker-compose.override.yml   local additions: published ports, demo tools on
```
