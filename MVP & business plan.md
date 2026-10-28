# Rost — MVP and business plan

Oct 28, 2026 · @eddie

## Summary

**What we build.** Rost helps people under 30 in Romania (wedge: fresh graduates) learn what to do with their money, on their own numbers. The app has three tabs:

- **Acasă:** every place to keep or grow money, from a savings account to gold, in a learning order set by the user's level. Each asset has all providers, their rates or fees, and a simulation graph.
- **Momente:** interactive lessons of 5 minutes or less, one topic each. Triggered moments (payslip arrived, inflation published) come first, then the ones for the user's level, then the rest. Finishing a level's core moments moves the user up.
- **Știri:** 2–3 real news items that move the user's money, such as fuel prices after the Iran war, each turned into lei a month on the user's numbers.

A 2-minute onboarding quiz sets the user's level and risk profile. **L0** means little or no knowledge, **L1** medium, **L2** advanced. The risk profile starts from age and level, then is capped by the emergency fund, expensive debt and when the money is needed.

**Learning order, not advice.** Every asset is shown to every user. The level changes the order and the label ("pentru nivelul tău", "mai departe"), never access. Rost never writes "recommended for you" next to a financial instrument, and the broker partner runs the legal appropriateness test when an account is opened. Recommending specific instruments based on a profile counts as a personal recommendation under MiFID II, which needs ASF authorisation; a lawyer confirms this before launch.

**Main selling point.** It lives inside the bank's app. The bank already knows the user's spending categories, so Știri and personal inflation are precise from day one. The standalone Rost app is the second front end on the same engine.

**How we earn.** Users pay nothing.

1. Bank, neobank and broker licences (main): Rost inside their app, paid per active user.
2. Employer seats: onboarding for young hires.
3. Neutral referrals from asset pages: a fee per funded savings, deposit or broker account. The ranking follows a public formula and never depends on who pays.

**What the hackathon MVP must prove, live on stage:**

1. The quiz works: two users get different levels, and Acasă reorders. A user without an emergency fund sees it first, at any level.
2. Asset pages are real: all providers ranked by a public formula, and simulations built from sourced data (fixed rates; historical ranges for ETFs, stocks and gold).
3. Learning moves people: a moment takes under 5 minutes, triggered moments jump to the top, and core moments level the user up.
4. Știri is personal: 3 real, sourced items, each with the user's lei-a-month impact.
5. The business works: a partner token opens Rost in the bank's theme, and a referral from an asset page ends in a tracked funded account.
6. The code is submittable: a demo mode (seeded JSON, works offline) and a working mode (Postgres).

**What the 12-week pilot must prove:** young users act, not just read; one bank or broker agrees to a paid pilot; one employer pays.

## Hackathon MVP scope

Build one path end to end and fake nothing that a juror can click. Everything simulated is labelled as simulated.

| Feature | In the MVP | How real |
| --- | --- | --- |
| Onboarding quiz: 6 knowledge questions set the level (L0–L2); 5 profile questions (age band, situation, emergency fund, expensive debt, when the money is needed); optional salary and spending mix | Must | Real scoring, unit-tested |
| Acasă: all 6 assets in learning order for the user's level, with "Întâi fundația" on top when the emergency fund is under 3 months | Must | Real |
| Asset page: what it is, risk, access, 2026 tax; all providers ranked (rate after tax, or cost for brokers); simulation graph; "Vreau să aflu mai multe despre X" | Must | Real formulas; example banks and brokers; Tezaur rates real (October 2026) |
| Momente: triggered first, then the user's level, then the rest; progress to the next level | Must | Real |
| 10 moments in Romanian: payslip, personal inflation, what-if, emergency fund, savings vs deposit, compound interest, state bonds, ETFs, stocks, gold | Must: 6 core + payslip · Should: all 10 | Real content, sourced figures |
| Știri: 3 real items, ordered by the user's exposure, with a lei-a-month slider | Must | Real news and sources; impact labelled as a scenario |
| Event simulator and demo clock | Must | Simulated, by design |
| Referral tracking from asset pages: click → mock bank or broker → "funded" postback → fee logged | Must | Real flow, mock provider |
| Partner view: personal inflation inside a mock bank app, opened with a signed token | Must | Real embed, mock bank |
| Metrics page: moments, actions, level-ups, referrals funded | Should | Real, from our events |
| Payslip photo reading (vision model, per-field confidence) | Could | Real, with typed-in fallback |
| Real bank data, live rates feed, real referrals, English UI, app-store apps | Won't (roadmap) | — |

**Definition of done, checked at feature freeze:**

- [ ] Two fresh users who score 1 and 6 on the quiz get L0 and L2, and see Acasă in a different order.
- [ ] A user with under 3 months of emergency fund sees "Întâi fundația" on top, at any level.
- [ ] No screen says "recomandat pentru tine" next to Fidelis, an ETF, a stock or a commodity.
- [ ] Every asset page ranks providers the same whether or not they're partners (a unit test proves it).
- [ ] Simulation numbers match hand-checked cases (unit tests), and every historical range names its source.
- [ ] Finishing the 3 core L0 moments moves an L0 user to L1.
- [ ] "Salary received" puts the payslip moment at the top of Momente in under 2 seconds.
- [ ] Știri shows 3 dated items with source links, and the user's lei-a-month figure moves with the slider.
- [ ] A referral click from an asset page ends in a "funded" event and a fee line on the metrics page.
- [ ] The whole demo runs offline from seeded data if the venue's wifi fails.

## Product spec

Three tabs, one profile. The quiz sets the profile; Acasă and Momente read the level; Știri reads the spending mix. All UI text is in Romanian.

**Onboarding quiz (about 2 minutes):**

1. Knowledge, 6 questions, "Nu știu" always allowed: inflation and cash, compound interest, one stock vs an index ETF, tax on state bonds, bond prices when rates rise, what an ETF is. Score 0–2 gives L0, 3–4 gives L1, 5–6 gives L2.
2. Profile: age band; situation (studying, just graduated, employed, PFA, between jobs); "if your income stopped, how many months could you live on savings?"; expensive debt (credit card, personal loan, buy now pay later); when the money might be needed.
3. Optional: gross salary, payday and hire date (sets the Pillar II deadline), and a 60-second spending mix for personal inflation and Știri.

**Levels:**

|  | L0 | L1 | L2 |
| --- | --- | --- | --- |
| Knowledge | Little or none | Medium | Advanced |
| Assets marked "pentru nivelul tău" | Savings account, term deposit | L0 + state bonds (Tezaur, Fidelis), index ETFs | L1 + stocks, gold and commodities |
| Core moments to move up | Emergency fund, savings vs deposit, compound interest | State bonds, ETFs | Stocks, gold |

**Risk profile** = level + 1 if under 30. A total of 0 is prudent, 1–2 echilibrat, 3 dinamic. Two caps apply:

- Money needed within a year: prudent.
- Emergency fund under 3 months, or expensive debt: at most echilibrat, and "Întâi fundația" shows on Acasă.

The profile shows as a label and flags assets above it ("risc peste profilul tău"). It never hides an asset.

**Acasă:**

- "Întâi fundația" card, only when needed: emergency fund first, then expensive debt.
- "Pentru nivelul tău": assets at or below the user's level, in a fixed order: savings account, deposit, state bonds, ETFs, stocks, gold and commodities.
- "Mai departe": the rest, marked with the level that unlocks the lesson.
- Each card: name, one line, risk 1–5, best rate after tax or lowest cost, "Vezi opțiuni și simulare".

**Asset page:**

- What it is, risk, access and 2026 tax.
- All providers, ranked by a public formula. Savings, deposits and state bonds go by net yearly rate after tax, then easier access, then name. Brokers go by the cost of a 1,000 lei order (commission plus currency spread), then name. Partners are labelled "we may earn a fee"; partner status is never an input.
- Simulation: sliders for starting amount, monthly amount and years, drawn as a line chart.
  - Fixed products: the value at the best net rate, what was paid in, and the same value in today's money at the user's inflation.
  - ETFs, stocks, gold: three lines from history (worst, typical, best 10-year period), never one rising line, plus "what a year like 2008 would do".
- A "Vreau să aflu mai multe despre X" button opens that asset's moment.

| Asset | Lesson level | Risk (1–5) | Simulation basis |
| --- | --- | --- | --- |
| Cont de economii | L0 | 1 | Best net rate in the list (10% tax on interest) |
| Depozit la termen | L0 | 1 | Best net rate in the list |
| Titluri de stat (Tezaur, Fidelis) | L1 | 1 | [Tezaur, October 2026 issue](https://www.goldring.ro/ro/news/ministerul-finantelor-majoreaza-dobanzile-la-titlurile-de-stat-fidelis-si-tezaur-in-octombrie-2026): 6.50% for 1 year, 7% for 3, 7.50% for 5, tax-free; Fidelis lei 6.60%–7.75% |
| ETF-uri pe indici | L1 | 3 | [MSCI World](https://en.wikipedia.org/wiki/MSCI_World) 1970–2025, yearly return over 10-year periods: worst −0.19%, typical 10.15%, best 19.92%; worst year 2008, −40.33% |
| Acțiuni | L2 | 5 | Same index band; one company can go to zero; [BET lost 70% in 2008](https://www.wall-street.ro/articol/Piete-de-capital/56291/cel-mai-prost-an-al-bursei-de-la-bucuresti-bet-a-pierdut-70.html) |
| Aur și mărfuri | L2 | 4 | [Gold via GLD](https://chartrow.com/gold/returns) 2005–2025, 10-year periods: worst 0.47%, typical 5.11%, best 14.61%; worst year 2013, −28.3% |

We computed the 10-year figures from the yearly returns on those pages (47 periods for MSCI World, 12 for gold). They are in dollars, before fees, taxes and currency moves, and the app says so.

**2026 tax on gains** ([impozitul.ro](https://impozitul.ro/impozit-bursa), to check against the Fiscal Code): through a Romanian broker, 3% if held over a year and 6% under a year, withheld at source. Through a foreign broker, 16%, declared in the Declarația unică.

**Momente:**

- Order: open triggered moments first (payslip arrived, inflation published, a what-if from Știri). Then "pentru nivelul tău" moments not yet done, core first. Then the rest, with done ones marked.
- Each takes 5 minutes or less. Step types: guess on a slider, multiple choice with an explanation, a reveal on the user's numbers, a card, then one action or a link to the asset page.
- Finishing a level's core moments moves the user up. The quiz level is the floor.
- At most one pushed moment a week, never two at once. Moments the user starts aren't capped. A follow-up comes 7 days after an action, and an action counts only once confirmed.

| Moment | Level | Opens when |
| --- | --- | --- |
| Fluturașul tău, explicat | L0 | Salary received, payslip uploaded, or the Pillar II deadline is within 30 days |
| Inflația ta luna asta | L0 | INS publishes inflation (monthly) |
| Ce-ar fi dacă… | L0 | A what-if from Știri |
| Fondul de urgență (core) | L0 | Library; pinned while the fund is under 3 months |
| Cont de economii sau depozit? (core) | L0 | Library |
| Dobânda la dobândă (core) | L0 | Library |
| Titluri de stat (core) | L1 | Library |
| ETF-uri (core) | L1 | Library |
| Acțiuni (core) | L2 | Library |
| Aur și mărfuri (core) | L2 | Library |

**The moment engine.** A moment is data, not code, so new moments ship without a release:

```json
{
  "id": "etf",
  "series": "Investiții",
  "level": 1,
  "core": true,
  "assetIds": ["etf"],
  "triggers": [],
  "steps": [
    {"type": "choice", "question": "Ce cumperi când cumperi un ETF pe un indice global?", "correct": 1},
    {"type": "predict", "question": "Cât a scăzut MSCI World în 2008?", "answerValue": -40.33},
    {"type": "reveal", "view": "asset_range", "assetId": "etf"},
    {"type": "card", "title": "Costuri și impozit"},
    {"type": "finish", "cta": {"label": "Vezi ETF-urile", "href": "/active/etf"}}
  ]
}
```

**Event simulator (demo only):** salary received, payslip uploaded, inflation published, a what-if, raise, and a demo clock. Each one writes an event and runs the same trigger code real events will use.

**Partner view:** the bank's app opens Rost with a signed token. The token carries only an age band, the triggering event and spending shares by category, so no customer data reaches us. The action button sends the user back to the bank's own screen.

## Știri: what the news means for your money

Știri shows 2–3 real items that move the user's money, each with dated facts, linked sources and "Ce înseamnă pentru tine" in lei a month. Items are ordered by the user's own exposure, so a driver sees fuel first and someone without a car sees the interest-rate item first. Each item links to one moment.

The items for the demo, as of 28 October 2026, with Maria's numbers (fuel 400 lei, electricity 150 lei a month, 2,500 lei saved, personal inflation 8.48%):

| Item | Facts we quote | On Maria's numbers | Moment |
| --- | --- | --- | --- |
| Oil stays expensive and the diesel excise cut ends on 31 October ([Ziarul Profit](https://www.ziarulprofit.ro/pret-carburanti-28-octombrie-2026-benzina-a-sazut-sub-10-lei-la-unele-statii/), [comparison](https://www.ziarulprofit.ro/preturile-carburantilor-au-explodat-in-romania-cat-costa-un-plin-de-benzina-sau-motorina-comparativ-cu-2025-si-cum-se-schimba-pretul-produselor-de-la-raft-din-aceasta-cauza/), [context](https://en.wikipedia.org/wiki/Economic_impact_of_the_2026_Iran_war)) | Brent $114.22 a barrel on 27 Oct. Petrol 10.10 and diesel 10.90 lei/L, against 7.46 and 7.66 a year ago. Without the excise cut, diesel could rise about 0.85 lei/L. Oil rose with the Iran war, which began on 28 Feb 2026 | +8% on fuel = +32 lei a month (slider 0–25%) | Fondul de urgență |
| Electricity bills could rise 20–22% this winter and spring ([Capital](https://www.capital.ro/facturile-la-gaze-si-energie-electrica-in-iarna-2026-2027-vor-exista-si-scumpiri-cu-peste-20.html)) | Estimate by the Ministry of Energy's secretary of state. Household gas has a regulated price, so no rise is expected there | +20% on electricity = +30 lei a month (slider 0–35%) | Inflația ta |
| BNR keeps its rate at 6.50% and expects inflation to rise again ([Bankingnews](https://bankingnews.ro/bnr-mentine-dobanda-cheie-la-650.html)) | Decided 8 Oct, the eighth meeting in a row. Drivers: fuel, energy, severe drought, the Middle East conflict, a weaker leu. Erste/BCR expect no cut before May 2027 | 2,500 lei in a current account loses about 195 lei a year; in Tezaur at 6.50%, tax-free, the loss shrinks to about 46 lei | Titluri de stat |

Item types we cover:

| Event | Official source | How often | What we compute for the user |
| --- | --- | --- | --- |
| Inflation release | INS | Monthly | Personal inflation, real salary, savings vs inflation |
| Interest-rate decision | BNR | Several times a year (BNR calendar) | Change on deposits and variable-rate loans |
| IRCC index | BNR | Quarterly, known a quarter ahead | Next payment on a variable-rate mortgage |
| Exchange rate | BNR daily EUR/RON | Monthly summary | Change in euro-priced rent or loan payments, in lei |
| Rule change | Monitorul Oficial | When published | What changes in your net pay, taxes or thresholds |
| Shock (war, shortage, energy) | Editorial, reviewed by a person | Rarely | A what-if scenario with a slider, never a forecast |

**Formulas to add to the rules engine:**

- Personal inflation = Σ (your share of spending in a category × that category's 12-month inflation).
- Real salary = salary ÷ (1 + inflation since your last raise).
- Euro exposure = monthly euro costs × the change in EUR/RON, shown in lei.
- Rate exposure ≈ variable loan balance × change in rate ÷ 12. The amortization engine gives the exact payment.
- Scenario = your monthly spend in the category × the shock the user sets on the slider.

**Worked example (demo data, September 2026):**

- INS figures: national inflation 6.61%; services +11.12%, non-food +7.06%, food +3%.
- Personal inflation: Maria spends 55% on services, 25% on non-food and 20% on food. 0.55 × 11.12 + 0.25 × 7.06 + 0.20 × 3 = 8.48%.
- Real salary: her 6,000 lei today buys what about 5,531 lei did a year ago.
- Scenario: fuel spend 400 lei a month × 8% = +32 lei a month.
- Savings: 2,500 lei × (1 ÷ 1.0848 − 1) = −195 lei a year in a current account.

**Where the spending mix comes from:**

- **Standalone app:** a 60-second "money mix" (rent and its currency, commute, food, utilities, loans).
- **Inside a bank's app:** transaction categories, aggregated on the bank's side. We receive category shares, never transactions.

**Actions a news moment can end in:**

- Update the buffer target to match personal inflation.
- A "raise conversation" card with the real-salary figure.
- A heads-up on the next variable-loan payment.
- The neutral ranked savings options.

**Guardrails:**

- Facts are quoted from named sources, each linked and dated.
- The user's figure is labelled "scenariu, nu prognoză". Its default is tied to a cited estimate where one exists (8% for diesel, 20% for electricity).
- No predictions of wars, markets or prices, and no "buy gold".
- Calm tone, no politics.
- An editor approves every item. An AI model may draft one, but never publishes it.

**Data model additions:**

| Table | Key fields |
| --- | --- |
| macro\_series | source, series, period, value, published\_at, url |
| news | id, date, title, facts\[\], sources\[\], impact (spend line + scenario, or savings), moment\_id, status (draft / approved), reviewed\_by |
| scenarios | id, title, context, spend\_line, default / min / max shock, status, reviewed\_by |
| spending\_profiles | user\_id, category shares, monthly fuel / electricity / food, source (self / bank) |

**Done when:** Maria's Știri shows the three items above in that order (+32, +30 and −195 lei a year), each with working source links, and each slider moves her figure live.

## Architecture and data model

One engine serves both our app and the partner view, so the bank screen in the demo is the real product, not a mock-up.

The repo is being split into two packages so backend and frontend can be built in parallel:

- **backend/**: an HTTP API (Node, Hono) holding the rules engine, moment engine, store (demo JSON or Postgres), referrals and partner tokens, with its own tests.
- **frontend/**: the Next.js app. It talks to the backend only over HTTP and imports response types from `backend/src/contract.ts`, types only.

&#91;embedded content: MVP architecture · 3 trigger sources, 1 engine, 2 front ends, 3 outputs\]

Events from all three sources pass the same trigger service. The engine computes every number from the rules engine, and both front ends record actions, referrals and metrics in one place.

**Data model (Postgres):**

| Table | Key fields |
| --- | --- |
| users | id, situation\[\], payday, hire\_date, gross\_monthly, monthly\_expenses, firsts\_done\[\], spending, profile (age\_band, quiz\_score, quiz\_level, level, risk\_profile, buffer\_months, expensive\_debt, horizon) |
| events | id, user\_id, type, payload, source (simulator / calendar / bank / user / editor), created\_at |
| moment\_runs | id, user\_id, moment\_id, trigger\_event\_id, state, guess, result, started\_at, completed\_at |
| actions | id, user\_id, moment\_run\_id, type, params, status (set / confirmed / skipped), follow\_up\_at |
| referrals | id, user\_id, offer\_id, partner\_id, click\_id, status (clicked / opened / funded), fee, updated\_at |
| offers (JSON) | id, asset\_id, provider, product, kind (deposit / state bond), gross\_rate, term\_months, access\_rank, min\_amount, conditions, partner\_id, example, source |
| brokers (JSON) | id, name, country (RO / EU), assets\[\], commission %, minimum commission, currency spread %, partner\_id, example |
| assets (JSON) | id, name, lesson level, risk 1–5, access, tax, simulation (fixed, or worst / typical / best yearly return + worst year + source), moment\_id |
| partners (JSON) | id, kind (bank / broker / employer), theme, token key, fee per funded account |

Reference data lives as JSON files in the repo, not in the database, so it's reviewed like code: moment definitions, assets, offers, brokers, partners, inflation, scenarios and Știri items.

**Rules-engine formulas (2026):**

- Pension contribution (CAS) = 25% × gross, of which Pillar II = 4.75% × gross.
- Health contribution (CASS) = 10% × gross.
- Income tax = 10% × (gross − CAS − CASS − personal deduction). The personal deduction depends on gross salary and dependants (verify the 2026 table).
- Net rate = gross rate × (1 − 10%) for deposits; gross rate for state bonds, which are tax-free.
- Real change in a year = amount × ((1 + net rate) ÷ (1 + inflation) − 1).
- Ranking for savings and bonds = sort by net rate, then easier access, then name. Partner status is not an input.
- Broker cost for an order = max(commission % × amount, minimum commission) + currency spread % × amount. Brokers are ranked by that cost, then name.
- Simulation = starting amount and monthly amount compounded monthly at the yearly rate, year by year. Run once for fixed products, three times (worst, typical, best) for market assets.
- Level = the higher of the quiz level and the highest level whose lower-level core moments are all done.
- Risk profile = level + 1 if under 30 (0 prudent, 1–2 echilibrat, 3 dinamic). Need the money within a year: prudent. Under 3 months of emergency fund or expensive debt: at most echilibrat.

Every formula gets tests with hand-checked cases, and every number on screen shows its formula and the year of the rules.

## Team plan: 5 engineers, \~24 build hours

**Suggested stack (swap anything the team knows better):**

- Frontend: Next.js + TypeScript, a mobile-first web app, Romanian UI.
- Backend: a separate Node API (Hono + TypeScript) with Vitest tests; the rules engine is pure TypeScript inside it.
- Postgres via Supabase or Docker; a demo mode on seeded JSON that works offline.
- Charts drawn as SVG in the frontend, from series the backend computes.
- A vision model for payslip photos, returning JSON against a fixed schema.
- Signed JWTs for the partner view.

| Who | Owns | Must work by |
| --- | --- | --- |
| E1 · Rules & simulation (backend) | Rules engine (payslip, real return, savings ranking, broker cost), simulation series, quiz scoring, levels and risk profile; tests with hand-checked cases plus the "partners don't change the order" test | Quiz and levels H6 · simulation H10 |
| E2 · API & triggers (backend) | API routes and contract types, store (demo and Postgres), event simulator, trigger service (one pushed moment a week), follow-ups, referral tracker with "funded" postback, partner token, Știri tailoring, metrics | Contract H2 · triggers H8 · Știri and referrals H12 |
| E3 · App UI (frontend) | App shell with Acasă, Momente, Știri; onboarding quiz; Acasă in learning order; moment player (choice, guess, reveal, card, action, finish) | Quiz and Acasă H8 · moment player H12 |
| E4 · Assets & partner UI (frontend) | Asset page with ranked providers and the simulation chart, Știri cards with sliders, mock bank and broker pages, partner view in a mock bank theme, metrics page | Asset page H10 · Știri H14 |
| E5 · Content & pitch | The 10 moments in Romanian and their sourced figures, Știri items (editor role), offer and broker seed data, payslip reader if time allows; slides, video, demo script | 6 core moments H8 · video H21 |

| Hours | Milestone |
| --- | --- |
| H0–H2 | Everyone: freeze scope from this tab; split repo (backend/ and frontend/) and CI; API contract types; database and moment schema; design tokens from the canvas; seed data |
| H2–H8 | Build in parallel; the frontend works against the contract and the demo backend |
| H8 | Checkpoint 1: quiz → level → Acasă in order; "salary received" → payslip moment → action, on a phone |
| H8–H14 | Asset pages with simulation, Momente levels, Știri, referrals, partner view |
| H14 | Checkpoint 2: the whole demo path works (ugly is fine) |
| H14–H18 | Polish, the remaining moments, metrics page, Romanian copy review |
| H18 | Feature freeze: run the definition-of-done checklist |
| H18–H21 | Record the 3-minute video; bug fixes only |
| H21–H24 | Rehearse the live demo 5 times; backup recording; test offline mode |

**Sleep in two shifts:** E1, E4 and E5 from H10 to H13; E2 and E3 from H13 to H16. Both owners of a checkpoint are never asleep at the same time.

**If time runs short, cut in this order:**

1. Payslip photo reading (keep typed-in).
2. Metrics page (show one slide).
3. Moments beyond the 6 core ones and the payslip.
4. Broker providers on the ETF, stock and gold pages (keep the simulation).
5. The live partner view (keep a screenshot).

Never cut: quiz → level → Acasă in learning order, an asset page with ranked providers and a partner label, and one Știri item on the user's numbers. Those are the product and the business.

## After the hackathon: the 12-week pilot MVP

The goal of the 12 weeks is evidence, not features: users who act, an employer who pays, a bank that signs. Each phase ends at a gate, and the next phase starts only if the gate is met.

| Weeks | Product | Business | Gate |
| --- | --- | --- | --- |
| 1–2 | Decide go or no-go. Six moments written and checked by a finance reviewer; privacy policy and consent screens | Form the company; get a lawyer's opinion on education vs advice, referral disclosures and data | — |
| 3–6 | Calendar triggers (payday, monthly inflation, bond windows, 25 May); catch-up for every situation; offers updated weekly with dates; referral tracking with 1–2 banks; installable web app | Campus pilot with 2 student organizations; recruit 1 employer | **G1: users act.** Starting target: 300 users, and at least 30% of started moments end in a confirmed action |
| 7–9 | Employer version: invite links per company, an HR summary with aggregated numbers only; first referral fees | Run the employer pilot. Prepare the bank pack: security answers, data processing agreement, pilot results | **G2: an employer pays**, even a small amount |
| 10–12 | Partner view on a real partner's token and theme; 90-day pilot metrics built in (completion, action, 90-day activity vs a control group) | Pitch 3–5 neobanks and brokers; propose a 90-day paid pilot on one segment | **G3: one paid pilot or a letter of intent** |

The targets are starting points we chose; revise them after the first 100 users.

**Team after the hackathon:**

- **E1:** rules and content engine, plus the yearly rule updates.
- **E2:** platform, integrations and security, which is what banks will audit.
- **E3:** app experience.
- **E4:** growth and analytics (campus, experiments).
- **E5 moves to business full-time:** employer sales, bank partnerships.
- **Hire first:** a part-time finance reviewer who signs off every moment's rules each year.

## Business plan

We're a business-to-business-to-consumer company: banks and employers bring the users and pay, so we don't have to buy users with ads. The free standalone app is where we prove which moments make people act.

**Customers and what they pay for:**

| Customer | Their problem | What they get | What they pay |
| --- | --- | --- | --- |
| People under 30 | Romanian money rules nobody explains when it matters | Moments on their own numbers, ending in actions | Nothing |
| Banks, neobanks, brokers (licence) | Young customers sign up but never start saving or investing; activation is bought with cashback | Moments inside their app, with the action completed in their product; activation measured | Yearly platform fee + monthly fee per active learner; optional fee per completed action |
| Employers with many young hires | New hires' money stress and payslip questions | First-job onboarding: payslip, pension fund, savings rule, PFA vs contract | Per new hire onboarded |
| Banks and brokers (referrals) | Acquiring savers who actually fund the account | Users who arrive from an asset page with a goal, a simulation and money ready, under neutral ranking | Per funded account |

**Price anchors, not prices.** Set prices in the first conversations, anchored to what each payer already spends:

- **Licence:** the bank's current cost of activating a young customer. Salt Bank returned over 3 million lei in cashback in one 2024 referral campaign.
- **Referrals:** existing referral rewards. ProCredit pays 500 lei per referred *business* in 2026; retail savings will pay less.
- **Employers:** their per-employee benefits budget.

**Unit economics, as formulas to fill with pilot data:**

- Licence revenue per month = active learners × price per learner + platform fee ÷ 12.
- Referral revenue per month = users who open an asset page × click rate × funded rate × fee per funded account.
- Employer revenue per year = hires onboarded × price per hire.
- Cost to serve per active user = photo-reading calls + hosting + support. Small, and falling as moments are reused.
- Fixed costs: the yearly rules update and finance review, the security and compliance work banks require, the team.
- Customer acquisition: employers and banks bring users in batches, at no cost to us or paid to us. Campus and short videos are cheap but slow, and they feed the standalone app.

**What we never sell:** ranking positions, user data, or ads. Breaking any of these ends the trust that makes the other three streams work.

## Go-to-market, competition and moat

**Sell in this order, because each step creates the evidence the next buyer asks for:**

1. **Campus and short videos.** Free and fast. Proves people act, and makes the content better.
2. **Employers.** HR decides quickly, and one contract brings a batch of users. Pitch: "fewer money-stressed new hires, and we never sell to your staff."
3. **Neobanks and brokers.** They move faster than big banks and are hungry for active young customers. Start with referrals, then upsell the licence.
4. **Traditional banks.** Longest sales cycle (security and compliance reviews), largest contracts. Approach with pilot data in hand.

**Competition and why we're different:**

| Alternative | What it does | Our difference |
| --- | --- | --- |
| Banks' own education pages and youth programmes | Generic articles under one brand | Triggered by your event, on your numbers, neutral across products |
| Rate-comparison sites | Tables for people already shopping | We reach people before they shop, and explain why before showing options |
| Finance creators and videos | Attention and generic advice | Romanian rules kept current, your own numbers, actions tracked |
| Finance learning apps (lessons, levels, streaks) | Generic lessons, gamified | Romanian products and rules, the user's own numbers and news, and every lesson ends at a real, neutrally ranked next step |
| Neobank tools (savings vaults, round-ups) | Tools without the "why" | Complementary: the action happens in their tools, which makes them licence customers |
| Zogo (US) | Youth financial education built on 200+ bank and credit-union partners | Proof the partner model works abroad. Not in Romania, and not triggered by real events |

**Moat, honestly ranked:**

1. **Partner integrations and the security approvals behind them.** Slow to get, and slow for a competitor to repeat.
2. **Action data:** which moments, at which trigger, lead young Romanians to act. It grows with every user.
3. **A Romanian rules engine kept current every year,** checked by a finance reviewer.
4. **Trust from neutral ranking.** Hard to fake once users have seen us rank a free state bond above our paying partners.

Lesson content on its own is easy to copy; don't count it as a moat.

## Milestones, KPIs, costs, risks, funding

**Milestones** (the targets are our choices; revise them with data):

| When | Milestone |
| --- | --- |
| Hackathon | Demo path live; definition of done met |
| Month 3 | Gates G1–G3: users act, an employer pays, one paid pilot or letter of intent |
| Month 6 | One bank or broker pilot live; 3 paying employers; 10 moments; referrals with 2–3 banks |
| Month 12 | First annual licence signed; pilot results published as a case study; second partner in progress |

**KPIs:**

- **North star:** confirmed actions per active user per quarter.
- **Funnel:** moments started → completed → action confirmed at the 7-day follow-up.
- **Retention:** active 4 weeks and 90 days after onboarding.
- **Referrals:** click rate, funded rate, fee per funded account.
- **Partners:** activation vs a control group, and renewal.

**Costs (categories to price in week 1):**

- The team.
- Photo-reading calls per payslip.
- Hosting in the EU.
- Legal: opinion, terms, data processing agreements.
- The part-time finance reviewer.
- A security test before the first bank deal.
- Company setup.

**Risks:**

| Risk | Mitigation |
| --- | --- |
| Seen as investment advice | Learning order, not recommendations: every asset shown to every user, no "recommended for you" on instruments, the broker runs the appropriateness test, historical ranges instead of a forecast line; a lawyer's opinion in week 1 |
| Users read but don't act | Measure confirmed actions, not opens; cut moments that don't lead to action |
| Banks buy slowly | Neobanks and brokers first, referrals before licences, employer revenue in the meantime |
| A partner wants to steer content | Neutrality clause in every contract; walk away if it's refused |
| A rule or number is wrong | Tests per rule, a yearly review by the finance reviewer, the formula and the year shown on every number |
| A data incident | Minimal data, partner tokens without personal data, EU hosting, deletion on request |
| Referral income stays small | It's the third stream by design; licences and employers carry the business |

**Funding:**

- **Start:** use the hackathon for visibility and partner introductions.
- **Grants:** check non-dilutive startup programmes for the first months (verify which are open).
- **Pre-seed:** raise after gates G2 and G3, with pilot data in hand. It covers about 12 months of team, compliance and security work.

## Pitch: kids accounts (not built)

An idea for the pitch, kept out of the implementation. Kids would get no Home, Momente or Știri, only small games, each a complete experience that teaches one concept by playing: saving vs spending pocket money, interest that grows a little every month, needs vs wants on a fixed budget, saving for a goal, and prices that go up. Short, visual, little text, on a phone or tablet. Kids collect badges; there are no levels and no risk profile.

At the end of a game a "Show your parent" screen says what the kid learned and what a savings account for a child is, with the bank options listed like on Acasă. That's the step that would turn the game into an account for the child.

Rules if it's ever built: no real money, purchases or ads; as little data about the child as possible; a parent agrees before the account exists (in Romania, children under 16 need parental consent under GDPR; check with a lawyer). Open questions: the age range (assumed 6–14), anything for teens 14–18, and linking a parent's account to a child's.

## Sources

Market and rule sources for the idea itself are in the "Young adults: Prima dată" tab. This plan adds:

- [Salt Bank: 330,000 clients and over 3 million lei cashback in its referral campaign](https://www.mobilissimo.ro/stiri-telefoane/salt-bank-incheie-anul-cu-330-000-de-clienti-si-3-milioane-lei-cashback-ce-pregateste-primul-neobank-romanesc-pentru-2025) — Mobilissimo, 17 Dec 2024
- [ProCredit "Parteneri de bancă": 500 lei per referred business](https://www.procreditbank.ro/wp-content/uploads/2026/04/Regulament-Campanie-Parteneri-de-banca-01.04.2026-–-31.07.2026.pdf) — ProCredit Bank, 2026
- [Zogo signs 200+ financial-institution partners](https://www.cuinsight.com/press-release/gen-z-targeted-zogo-app-reaches-milestone-signing-200-financial-institution-partners/) — CUInsight, 21 Jun 2022
- [Under-35s must join Pillar II within 4 months](https://www.mediafax.ro/?p=2532063) — Mediafax, 8 Apr 2008
- [Tezaur and Fidelis rates, October 2026 issue](https://www.goldring.ro/ro/news/ministerul-finantelor-majoreaza-dobanzile-la-titlurile-de-stat-fidelis-si-tezaur-in-octombrie-2026) — Goldring, October 2026
- [MSCI World gross annual returns, 1970–2025](https://en.wikipedia.org/wiki/MSCI_World) — Wikipedia; 10-year figures computed by us
- [Gold (GLD) returns by year, 2005–2026](https://chartrow.com/gold/returns) — chartrow.com, as of 26 Oct 2026; 10-year figures computed by us
- [BET lost 70% in 2008](https://www.wall-street.ro/articol/Piete-de-capital/56291/cel-mai-prost-an-al-bursei-de-la-bucuresti-bet-a-pierdut-70.html) — Wall-Street.ro
- [Tax on stock and ETF gains in 2026](https://impozitul.ro/impozit-bursa) — impozitul.ro (check against the Fiscal Code)
- [Fuel prices on 28 October 2026](https://www.ziarulprofit.ro/pret-carburanti-28-octombrie-2026-benzina-a-sazut-sub-10-lei-la-unele-statii/) and [the comparison with 2025 and the excise cut](https://www.ziarulprofit.ro/preturile-carburantilor-au-explodat-in-romania-cat-costa-un-plin-de-benzina-sau-motorina-comparativ-cu-2025-si-cum-se-schimba-pretul-produselor-de-la-raft-din-aceasta-cauza/) — Ziarul Profit, 28 Oct 2026
- [Gas and electricity bills in winter 2026–2027](https://www.capital.ro/facturile-la-gaze-si-energie-electrica-in-iarna-2026-2027-vor-exista-si-scumpiri-cu-peste-20.html) — Capital, 7 Oct 2026
- [BNR keeps the key rate at 6.50%](https://bankingnews.ro/bnr-mentine-dobanda-cheie-la-650.html) — Bankingnews, 8 Oct 2026
- [Economic impact of the 2026 Iran war](https://en.wikipedia.org/wiki/Economic_impact_of_the_2026_Iran_war) — Wikipedia
- [Annual inflation 6.61% in September 2026](https://www.wall-street.ro/articol/economie/inflatia-anuala-creste-la-661-in-septembrie.html) — INS, via Wall-Street.ro
