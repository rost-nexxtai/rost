# Rost

**What your money life, and the news, mean for you.**
Built for the Stripe NEXXT AI Hackathon, Bucharest 2026 ("Rethinking Financial Futures").

Rost gives young Romanians (under 30, starting with fresh graduates) a 3-minute **moment** when something happens. That might be their first payslip, this month's inflation figures, or a what-if shock such as a fuel shortage. Each moment uses **their own numbers** and ends in **one action**. A week later we check whether they did it.

It runs in two places:

- **Inside bank apps (the partner view).** The bank opens a moment with a short-lived signed token. The token carries spending *shares* by category and an age band, and nothing that identifies the customer.
- **As a standalone web app**, which is what this repo runs.

Money comes from bank, neobank and broker licences (main line), employer seats, and neutral referrals. A referral fee is paid only on funded accounts. The ranking follows a public formula, and partner status is never an input; a test checks this.

> Education, not financial advice. Rost never moves money.

---


## Repo layout

Two packages in one npm workspace, so backend and frontend can be built in parallel:

| Package | What it is | Who owns it |
| --- | --- | --- |
| `backend/` | Hono API on :4000: rules engine, moment engine, store (demo JSON or Postgres), referrals, partner tokens, tests. Request and response shapes live in `backend/src/contract.ts`. | Backend team |
| `frontend/` | Next.js app on :3000, Romanian UI. Talks to the backend only over HTTP (`/api/*` is proxied to it) and imports **types only** from `backend/src/contract.ts`. | Frontend team |

## Quick start: demo mode (offline, seeded JSON)

```bash
npm install
cp backend/.env.example backend/.env.local     # DATA_MODE=demo, ALLOW_DEMO_TOKEN=true
cp frontend/.env.example frontend/.env.local   # BACKEND_URL=http://localhost:4000
npm run dev                                    # API on :4000, app on http://localhost:3000
```

Click **Continuă ca Maria (demo)**. Maria is a synthetic persona: a graduate hired on 2026-09-01 with a 6,000 lei gross salary, at level L1, with less than a month of emergency fund. Backend data is held in memory and goes back to the seed on restart, or when you press **Resetează demo-ul** in the Simulator.

## Working mode (Postgres)

```bash
docker compose up -d db
# in backend/.env.local: DATA_MODE=db
npm run db:migrate              # applies backend/db/migrations/*.sql and seeds Maria
npm run dev
```

Both modes run the same backend code through one `Store` interface: `JsonStore` in demo mode, `PgStore` in working mode. One contract test runs against both (`backend/src/lib/store/store.test.ts`, using pg-mem).

## Where the frontend gets its data

Every screen reads through `frontend/src/data/index.ts`. Some functions call the real API; the rest return typed fixtures until the backend ships the endpoint.

| Screen | Source today | Proposed endpoint |
| --- | --- | --- |
| Session, Maria login, moment runs and the player, follow-ups, simulator, clock, calendar, partner view, referral click → mock bank → funded, metrics | **Real API** | (exists) |
| Quiz, level and risk profile | Fixtures + `data/mock/scoring.ts`, profile kept in the `rost_profile` cookie | `POST /api/quiz`, profile on `GET /api/me` |
| Acasă | `data/mock/acasa.ts` | `GET /api/acasa` |
| Asset pages (providers, simulation) | `data/mock/ranking.ts`, `data/mock/simulation.ts` | `GET /api/assets/:id` |
| Momente (library, level progress) | `data/mock/momente.ts` + real triggered runs from `/api/today` | `GET /api/momente` |
| Știri | `data/mock/stiri.ts` | `GET /api/stiri` |

The proposed response types are in `frontend/src/data/types.ts`, each tagged with its endpoint. When the backend team agrees a shape, it moves to `backend/src/contract.ts` and one function body in `data/index.ts` switches to the real call. Every file in `data/mock/` says what replaces it; its tests (the MVP's definition-of-done checks) can move with the logic.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API and app together (`dev:backend`, `dev:frontend` for one) |
| `npm test` | Backend tests: rules, engine, store parity, end-to-end flow |
| `npm test -w frontend` | Frontend tests: mock scoring, ranking neutrality, simulation, Știri, copy |
| `npm run typecheck` | `tsc --noEmit` in both packages |
| `npm run build` | Both packages |
| `npm run db:migrate` | Working mode: run migrations and seed the demo user |

Don't run `npm run build -w frontend` while `npm run dev` is running: they share `frontend/.next`, and the dev server starts serving stale modules. Stop dev first, or delete `frontend/.next` afterwards.

## Demo script (about 5 minutes)

1. **The hook:** "Who here knows which Pillar II fund they're in?"
2. **The quiz.** Start the 2-minute test. Answer "Nu știu" a lot → L0, Acasă shows savings and deposits first. **Profil → Resetează**, retake it with all answers right → L2, the order changes. Every asset is always listed; only the order and the labels change.
3. **Maria.** Resetează, then **Continuă ca Maria**. Acasă puts **Întâi fundația: fondul de urgență** on top, because she has less than a month saved.
4. **An asset page.** Open *Titluri de stat*: all providers ranked by net rate after tax (Fidelis 7.75%, then Tezaur), partners labelled, the simulation sliders. Open *ETF-uri*: a worst-to-best band from history, never one rising line, plus "Un an ca 2008".
5. **The business, part 1.** From *Depozit la termen*, **Deschide** on a partner bank → mock bank → **Deschide contul** → **Alimentează-l**. A fee is recorded only for a funded account at a partner.
6. **A moment, live.** **Profil → Simulator → A intrat salariul.** Momente now shows the payslip moment on top. Play it: guess the pension contribution, see 1,500 lei (285 lei into Pillar II), set a 400 lei payday savings rule.
7. **A library lesson.** Momente → *Fondul de urgență*: choice, guess, cards, done. Profil shows the progress to the next level.
8. **Știri.** Fuel after 31 October: +32 lei a month on Maria's numbers; drag the slider. Electricity +30 lei. BNR: 2,500 lei in a current account loses 195 lei a year, 46 lei in Tezaur.
9. **The business, part 2.** **Simulator → Deschide ca [PARTNER BANK]**: the inflation moment in the bank's colours, from a signed token. **Metrici** shows the action rate and the fee.

## How it works

```
backend/
  data/                     reference data, versioned JSON, reviewed like code
  db/migrations/            Postgres schema for runtime data
  src/contract.ts           every request and response shape the API speaks
  src/routes/               Hono routes under /api
  src/lib/rules/            pure money rules 2026: payslip, inflation, ranking, dates
  src/lib/moments/          engine (decide which moment opens) and views (numbers per user)
  src/lib/store/            Store interface, JsonStore (demo), PgStore (db)
frontend/
  src/app/                  Next.js pages: /, /quiz, /acasa, /active/[id], /momente, /moment/…, /stiri, /profil, demo tools
  src/components/ui/        design system: tokens in globals.css, TabBar, cards, RiskMeter, SimChart (SVG), Slider
  src/data/                 the one door to data: types, fixtures, mock logic, server actions
  src/lib/api.ts            server-side backend calls that forward the session cookie
```

**Triggers.** Every trigger goes through the backend's `handleEvent` and then `decide()`. Triggers come from the user, the calendar, a bank webhook, or the news desk. The engine applies four rules:

- **Conditions:** the user's situation and the data the moment needs.
- **Never twice:** a completed "first" doesn't open again.
- **No duplicates:** a moment that's already open isn't opened a second time.
- **Weekly cap:** at most one moment every 7 days, unless the user asked for it.

**Formulas.** In `backend/src/lib/rules` (and mirrored in `frontend/src/data/mock` until the new endpoints exist):

- **Payslip:** CAS 25% (of which Pillar II 4.75%), CASS 10%, income tax 10% on gross − CAS − CASS.
- **Personal inflation:** Σ (your share × INS group rate).
- **Ranking:** net rate after tax, then access, then name. Deposit interest is taxed at 10%; state bonds are tax-free. Brokers: the cost of a 1,000 lei order. Partner status is never an input.
- **Level:** quiz score 0–2 → L0, 3–4 → L1, 5–6 → L2; finishing a level's core lessons moves you up. **Risk profile:** level + 1 if under 30, capped by horizon, emergency fund and expensive debt.

## API

| Route | Purpose |
| --- | --- |
| `POST /api/users` | Create a user (onboarding) or `{demo:"maria"}`; sets the session cookie |
| `POST /api/events` | Fire an event: `salary_received`, `inflation_published`, `shock_scenario`, `raise`, `catch_up`, … |
| `POST /api/calendar` | Run today's computed triggers for the current user |
| `GET/POST /api/moments/:runId` | Load a moment with its view; post a guess, an action or a dismiss |
| `GET/POST /api/followups` | Due 7-day checks; confirm or skip |
| `GET /r/:offerId` | Referral click, then the provider (the mock bank in the demo) |
| `POST /api/referrals/postback` | Partner reports `opened` or `funded`; set `POSTBACK_SECRET` in production |
| `GET /api/partner/demo-token` | Stage only: signs a demo partner token |
| `GET /embed?token=` | Partner view |
| `POST /api/payslip/read` | Optional: reads a payslip photo with Claude when `ANTHROPIC_API_KEY` and `PAYSLIP_MODEL` are set. The image is not stored |
| `GET /api/metrics` | Aggregates only |
| `POST /api/clock`, `POST /api/demo/reset` | Stage helpers (demo mode) |

## Suggested ownership (5 engineers)

- **E1 Rules and data:** `backend/src/lib/rules`, `backend/data/seed`, personal deduction (TODO below), rates refresh.
- **E2 Engine and triggers:** `backend/src/lib/moments`, `calendar.ts`, events, the simulator.
- **E3 App UI:** quiz, Acasă, Momente, the moment players (`frontend/`).
- **E4 Assets and partner UI:** asset pages, Știri, `/embed`, the partner token, postbacks, the mock bank, metrics.
- **E5 Platform:** the Store and Postgres, migrations, CI, deployment, the payslip reader.

## Known limits (say them before a judge does)

- **Personal deduction is not applied yet** (`PERSONAL_DEDUCTION_IMPLEMENTED = false`), so the tax shown is slightly high for lower salaries. E1 should implement the 2026 table and check it against real payslips.
- **Offers, fees and partners are examples.** Before showing real providers, use live rates and signed agreements. Never use a real bank's name or branding without one.
- **Inflation** is the INS September 2026 release (headline 6.61%; services, non-food and food groups), as reported by Wall-Street.ro. Check it against the INS press release before the demo.
- **Real salary** uses 12-month personal inflation. It is not a since-your-last-raise index.
- **Scenarios are what-ifs, not forecasts.** Only editor-approved ones reach users.
- **The demo clock and demo token** are stage helpers. Disable them in production (`ALLOW_DEMO_TOKEN=false`).
- **No real users or reviews** are claimed anywhere. The metrics page counts this instance only.
