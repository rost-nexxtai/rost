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

The UI is a client-only React + TypeScript app (Vite) with example data. It covers the adult experience only so far and doesn't call the backend yet:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

## Layout

```
Architecture.md      target product: adult accounts (Home, Moments, News; levels L0–L2) and child accounts (games)
backend/             Go API (net/http, pgx), Dockerfile
frontend/            React UI, adults only so far: onboarding quiz, Home, Momente, Știri (example data)
docker-compose.yml   Postgres + backend
```
