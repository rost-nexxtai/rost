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

## Quick start: demo mode (offline, seeded JSON)

```bash
npm install
cp .env.example .env.local      # DATA_MODE=demo, ALLOW_DEMO_TOKEN=true
npm run dev                     # http://localhost:3000
```

Click **Continue as Maria (demo)**. Maria is a synthetic persona: a graduate hired on 2026-09-01 with a 6,000 lei gross salary. Everything is held in memory and goes back to the seed on restart, or when you press **Reset demo** in the Simulator.

## Working mode (Postgres)

```bash
docker compose up -d db
cp .env.example .env.local
# in .env.local: DATA_MODE=db
npm run db:migrate              # applies db/migrations/*.sql and seeds Maria
npm run dev
```

Both modes run the same code through one `Store` interface: `JsonStore` in demo mode, `PgStore` in working mode. One contract test runs against both (`src/lib/store/store.test.ts`, which uses pg-mem).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Vitest: rules, engine, store parity, end-to-end flow |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:migrate` | Working mode: run migrations and seed the demo user |

## Demo script (about 4 minutes)

1. **Landing → Continue as Maria.**
2. **Simulator → Clock +30 days, +7 days, then Run today's calendar.**
   - The Pillar II deadline (hire date + 4 months = 2026-12-31) is now under 30 days away, so the calendar opens *Your payslip, explained* by itself. Nobody pressed a button for it.
   - Alternative: press **Salary received**. This is what a bank webhook would send.
3. **Play the payslip moment.**
   - She guesses her pension contribution.
   - The answer is 1,500 lei, of which 285 lei goes to her own Pillar II account.
   - A card covers "the fund nobody chose".
   - The action is a 400 lei payday savings rule.
4. **Simulator → INS publishes inflation.** *Your inflation this month*:
   - National inflation is 6.61%; Maria's is 8.48%, because services weigh more in her spending.
   - Her 6,000 lei now buys what 5,531 lei did a year ago.
   - 10,000 lei in a current account loses 782 lei a year against her inflation.
   - A fuel what-if slider shows how much extra a fuel shortage would cost her.
5. **Options.** A neutral ranking:
   - State bonds come first, then deposits, ordered by return after tax.
   - Partner badges are visible, and the fee is explained.
   - Open → mock bank → Open → Fund. A fee is recorded only when a funded account belongs to a partner.
6. **Simulator → Open as [PARTNER BANK].** The same inflation moment, in the bank's colours, from a signed token. Nothing is stored.
7. **Simulator → +7 days → Today.** A follow-up asks "Did you set it up?". **Metrics** shows the action rate and the payslip-guess gap.

## How it works

```
data/                     reference data, versioned JSON, reviewed like code
  moments/*.json          moment definitions: triggers, conditions, steps
  seed/macro.json         INS inflation (headline and 3 groups) with source
  seed/offers.json        savings options (EXAMPLE rates)
  seed/partners.json      partner banks (placeholders, example fees)
  seed/scenarios.json     what-if shocks, editor-approved only
  seed/demo-users.json    Maria (synthetic)
db/migrations/            Postgres schema for runtime data
src/lib/rules/            pure money rules 2026: payslip, inflation, ranking, dates
src/lib/moments/          engine (decide which moment opens) and views (numbers per user)
src/lib/store/            Store interface, JsonStore (demo), PgStore (db)
src/lib/calendar.ts       payday, Pillar II deadline, INS release: computed triggers
src/lib/partner-token.ts  HS256 token a bank signs to open the partner view
src/lib/service.ts        handleEvent, guesses, actions, follow-ups, referrals
src/app/                  Next.js pages and API routes
```

**Triggers.** Every trigger goes through `handleEvent` and then `decide()`. Triggers come from the user, the calendar, a bank webhook, or the news desk. The engine applies four rules:

- **Conditions:** the user's situation and the data the moment needs.
- **Never twice:** a completed "first" doesn't open again.
- **No duplicates:** a moment that's already open isn't opened a second time.
- **Weekly cap:** at most one moment every 7 days, unless the user asked for it.

**Formulas.** All of these live in `src/lib/rules`:

- **Payslip:** CAS 25% (of which Pillar II 4.75%), CASS 10%, income tax 10% on gross − CAS − CASS.
- **Personal inflation:** Σ (your share × INS group rate).
- **Ranking:** net rate after tax, then access, then name. Deposit interest is taxed at 10%; state bonds are tax-free.

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

- **E1 Rules and data:** `src/lib/rules`, `data/seed`, personal deduction (TODO below), rates refresh.
- **E2 Engine and triggers:** `src/lib/moments`, `calendar.ts`, events, the simulator.
- **E3 App UI:** onboarding, Today, the moment player, options.
- **E4 Partner and referrals:** `/embed`, the partner token, postbacks, the mock bank, metrics.
- **E5 Platform:** the Store and Postgres, migrations, CI, deployment, the payslip reader.

## Known limits (say them before a judge does)

- **Personal deduction is not applied yet** (`PERSONAL_DEDUCTION_IMPLEMENTED = false`), so the tax shown is slightly high for lower salaries. E1 should implement the 2026 table and check it against real payslips.
- **Offers, fees and partners are examples.** Before showing real providers, use live rates and signed agreements. Never use a real bank's name or branding without one.
- **Inflation** is the INS September 2026 release (headline 6.61%; services, non-food and food groups), as reported by Wall-Street.ro. Check it against the INS press release before the demo.
- **Real salary** uses 12-month personal inflation. It is not a since-your-last-raise index.
- **Scenarios are what-ifs, not forecasts.** Only editor-approved ones reach users.
- **The demo clock and demo token** are stage helpers. Disable them in production (`ALLOW_DEMO_TOKEN=false`).
- **No real users or reviews** are claimed anywhere. The metrics page counts this instance only.
