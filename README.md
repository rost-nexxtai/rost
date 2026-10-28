# Rost

Built for the Stripe NEXXT AI Hackathon, Bucharest 2026 ("Rethinking Financial Futures").

Rost helps Romanians understand their money. It has two kinds of accounts:

- **Adults:** an onboarding quiz sets their financial-education level and risk profile, then the app shows instruments in priority order for that profile, short interactive lessons ("moments"), and news that affects their finances.
- **Children:** small, self-contained games that teach one financial concept each (saving, interest, needs vs wants). At the end, a kid can show a parent what they learned, which is how the experience leads to a savings account for the child.

The product we are building is described in [Architecture.md](Architecture.md). The other documents ([Simple brief](Simple%20brief.md), [MVP & business plan](MVP%20%26%20business%20plan.md), [Young adults: Prima dată](Young%20adults%20Prima%20dat%C4%83.md)) cover the earlier hackathon MVP and the business case. That MVP's code is in git history up to commit `99b905c`.

> Education, not financial advice.

## Run it

```bash
docker compose up -d --build
curl localhost:8080/readyz
```

This starts Postgres 16 (`db`, port 5432) and the Go API (`backend`, port 8080). See [backend/README.md](backend/README.md) for configuration and local development.

The UI is a Next.js app. It covers the adult experience only so far and gets its data from mock fixtures in `frontend/src/data/`, not from the backend yet. Its design and plan are in [docs/superpowers](docs/superpowers):

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

## Layout

```
Architecture.md      target product: adult accounts (Home, Moments, News; levels L0–L2) and child accounts (games)
backend/             Go API (net/http, pgx), Dockerfile
frontend/            Next.js UI, adults only so far: quiz, Acasă, Momente, Știri, profile (mock data)
docs/                frontend design spec and implementation plan
docker-compose.yml   Postgres + backend
```
