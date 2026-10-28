# Prima dată — MVP and business plan

Oct 28, 2026 · @eddie

## Summary

**What we build.** Prima dată sends Romanians under 30 a 3-minute "moment" when something happens in their money life. Each moment uses their own numbers and ends in one action. Moments are triggered by the user, by the calendar, or later by the bank.

**How we earn.** Users pay nothing. Revenue comes from three streams, in order of size:

1. **Bank, neobank and broker licences:** our moments inside their app, paid per active learner.
2. **Employer seats:** onboarding for first-job hires.
3. **Neutral referrals:** a fee per funded savings account, which never affects the ranking.

**What the hackathon MVP must prove, live on stage:**

1. **A trigger opens a moment.** A simulated event ("salary received") leads to a notification, then the moment.
2. **The numbers are real.** A payslip, typed in or photographed, goes through a tested 2026 rules engine and comes out as a personal reveal.
3. **It ends in action.** One action is recorded, ranked options show a partner link, and the same moment runs inside a mock bank app. That's the business, working.

**What the 12-week pilot must prove:** young users take the action (not just read), one employer pays, and one bank or broker agrees to a paid pilot.

## Hackathon MVP scope

Build one path end to end and fake nothing that a juror can click. Everything simulated is labelled as simulated.

| Feature | In the MVP | How real |
| --- | --- | --- |
| Onboarding: 3 questions (situation, payday or hire date, firsts already done) | Must | Real |
| Today screen: next moment, "Your moments", catch-up list | Must | Real |
| Moment engine: moments defined as data (trigger → condition → steps → action → follow-up) | Must | Real |
| Moment A, payslip: guess, reveal from your numbers, Pillar II card, payday savings rule | Must | Real numbers; typed in, photo as a bonus |
| Moment B, savings: inflation reveal, then options ranked by net return, with partner links | Must | Real formula; example offers |
| Event simulator: hidden panel firing *salary received*, *inflation published*, *graduated* | Must | Simulated, by design |
| Referral tracking: click → mock bank page → "funded" postback → fee logged | Must | Real flow, mock bank |
| Partner view: moment A inside a mock bank app, opened with a signed token | Must | Real embed, mock bank |
| Metrics page: moments started, actions completed, referrals funded | Should | Real, from our events |
| Payslip photo reading (vision model, per-field confidence) | Should | Real, with typed-in fallback |
| Change moment ("your raise: what changed"), Romanian/English switch | Could | — |
| Real bank data, real referrals, investing and PFA moments, app-store apps | Won't (roadmap) | — |

**Definition of done, checked at feature freeze:**

- [ ] A fresh user finishes onboarding and sees a different Today screen for "student" vs "employed".
- [ ] "Salary received" fires a notification that opens moment A in under 2 seconds.
- [ ] For 5 test payslips, the reveal matches hand-checked numbers to the leu (rules-engine tests pass).
- [ ] The savings action is stored and shows as done after a simulated follow-up.
- [ ] The ranking is the same no matter which offers are partners (a unit test proves it).
- [ ] A referral click ends in a "funded" event and a fee line on the metrics page.
- [ ] Moment A runs inside the mock bank app, themed and from the same code.
- [ ] The whole demo runs offline from seeded data if the venue's wifi fails.

## Product spec

**Onboarding (under 60 seconds):**

1. *What's your money situation right now?* Studying, just graduated, employed, freelance (PFA), between jobs. Pick all that apply.
2. *When do you get paid?* Day of the month; for the employed, also the hire date, which drives the Pillar II 4-month deadline.
3. *Which of these have you already done?* Got a payslip, saved money, opened an investing app, freelanced, filed a tax return. Every ticked item becomes a catch-up moment.

**The moment engine.** A moment is data, not code, so new moments ship without a release. Every moment has the same fields:

```json
{
  "id": "payslip_explained",
  "triggers": ["salary_received", "payslip_uploaded", "catch_up"],
  "conditions": {"situation": ["employed"], "not_done": "payslip_explained"},
  "steps": [
    {"type": "predict", "question": "Out of your gross, how much goes to your future?", "answer": "rules.payslip.pension_total"},
    {"type": "reveal", "breakdown": "rules.payslip.split"},
    {"type": "card", "content": "pillar2_assigned"},
    {"type": "action", "action": "payday_savings_rule"}
  ],
  "follow_up_days": 7,
  "repeat_on": ["raise_detected", "new_year_rules"]
}
```

**Notification rules:** at most one moment a week, never two at once, silent when the conditions fail. A follow-up check comes 7 days after the action. Without a confirmed action the moment isn't counted as done.

**Moment A: your payslip, explained** (works on any payslip, not just the first)

1. Predict: a slider guesses how much of gross goes to the pension.
2. Reveal from the user's numbers: pension contribution 25% (4.75% of gross into their own Pillar II account), health 10%, income tax, take-home.
3. Card: "the fund you were assigned", with a link to check it, and no fund recommendation.
4. Action: a payday savings amount and target (3 months of expenses), done in the user's own bank.

**Moment B: your first savings**

1. Trigger: "inflation published" (monthly) for users with savings ticked or a balance entered.
2. Reveal: what a year did to their amount in cash, a deposit after the 10% tax, and a tax-free state bond.
3. Ranked options (rules below), then the action: open, or add the next state-bond window to the calendar.

**Ranked options rules:** guaranteed products only (deposits and state bonds), filtered by when the money is needed, ranked by net yearly return after tax. Ties go to easier access, then alphabetical. Partners are labelled, and the fee is paid only on funded accounts. The formula is behind a "How we rank" link.

**Event simulator (demo only):**

- *salary received*, *payslip uploaded*, *inflation published*, *bond window open*, *graduated*, *raise*.
- Each one writes an event and runs the same trigger code real events will use.

**Partner view:** the bank's app opens our moment with a signed token. The token carries only an age band, the triggering event and the bank's theme, so no customer data reaches us. The action button sends the user back into the bank's own screen.

## Architecture and data model

One engine serves both our app and the partner view, so the bank screen in the demo is the real product, not a mock-up.

&#91;embedded content: MVP architecture · 3 trigger sources, 1 engine, 2 front ends, 3 outputs\]

Events from all three sources pass the same trigger service. The engine computes every number from the rules engine, and both front ends record actions, referrals and metrics in one place.

**Data model (Postgres):**

| Table | Key fields |
| --- | --- |
| users | id, situation\[\], payday, hire\_date, age\_band, firsts\_done\[\], locale |
| events | id, user\_id, type, payload, source (simulator / calendar / bank), created\_at |
| moment\_runs | id, user\_id, moment\_id, trigger\_event\_id, state, guess, result, started\_at, completed\_at |
| actions | id, user\_id, moment\_run\_id, type, params, status (set / confirmed / skipped), follow\_up\_at |
| offers | id, provider, product, kind (deposit / state bond), gross\_rate, tax\_rate, term\_months, access\_rank, min\_amount, conditions, is\_partner, updated\_at, source\_url |
| referrals | id, user\_id, offer\_id, click\_id, status (clicked / opened / funded), fee, updated\_at |
| partners | id, kind (bank / broker / employer), theme, token\_key, referral\_terms |

Moment definitions live as JSON files in the repo, not in the database, so they're reviewed like code.

**Rules-engine formulas (2026):**

- Pension contribution (CAS) = 25% × gross, of which Pillar II = 4.75% × gross.
- Health contribution (CASS) = 10% × gross.
- Income tax = 10% × (gross − CAS − CASS − personal deduction). The personal deduction depends on gross salary and dependants (**verify** the 2026 table).
- Net rate = gross rate × (1 − 10%) for deposits; gross rate for state bonds, which are tax-free.
- Real change in a year = amount × ((1 + net rate) ÷ (1 + inflation) − 1).
- Ranking = sort by net rate, then easier access, then name. Partner status is not an input.

Every formula gets tests with hand-checked cases, and every number on screen shows its formula and the year of the rules.

## Team plan: 5 engineers, \~24 build hours

**Suggested stack (swap anything the team knows better):**

- Next.js + TypeScript as a mobile-first web app.
- Postgres via Supabase, hosted on Vercel.
- The rules engine as a pure TypeScript package with Vitest tests.
- A vision model for payslip photos, returning JSON against a fixed schema.
- Signed JWTs for the partner view.

| Who | Owns | Must work by |
| --- | --- | --- |
| E1 · Rules & engine | Rules engine (payslip split, real return, ranking), condition evaluator, moment schema; tests with 5 hand-checked payslips plus the "partners don't change the order" test | Payslip H8 · ranking H12 |
| E2 · Backend & triggers | Database, API, event simulator, trigger service (one moment a week), follow-ups, referral tracker with "funded" postback, partner token signing, metric events | Triggers H8 · referrals and token H14 |
| E3 · App UI | App shell, onboarding, Today, moment player (predict, reveal, card, action), offline seeded mode | Moment A H8 · moment B H14 |
| E4 · Savings & partner UI | Ranked options screen, mock bank page for referrals, partner view in a mock bank theme, metrics page | H14 |
| E5 · Payslip reader & pitch | Photo reading with confidence and typed fallback (H12); then test payslips, offer seed data, validation calls, slides, video; owns the demo script | Reader H12 · video H21 |

| Hours | Milestone |
| --- | --- |
| H0–H1 | Everyone: freeze scope from this tab, repo and CI, database schema, moment schema, design tokens from the canvas, seed data |
| H1–H8 | Build in parallel |
| **H8** | **Checkpoint 1:** "salary received" → moment A → action, on a phone, typed-in payslip |
| H8–H14 | Moment B, ranking, referrals, partner view |
| **H14** | **Checkpoint 2:** the whole demo path works (ugly is fine) |
| H14–H18 | Polish, photo reading, metrics page, copy review |
| **H18** | **Feature freeze:** run the definition-of-done checklist |
| H18–H21 | Record the 3-minute video; bug fixes only |
| H21–H24 | Rehearse the live demo 5 times; backup recording; test offline mode |

**Sleep in two shifts:** E1, E4 and E5 from H10 to H13; E2 and E3 from H13 to H16. Both owners of a checkpoint are never asleep at the same time.

**If time runs short, cut in this order:**

1. Photo reading (keep typed-in).
2. Metrics page (show one slide).
3. Change moment.
4. The live partner view (keep a screenshot).

Never cut: trigger → moment A → action, and the ranked options with a partner label. Those two are the product and the business.

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
| Banks (referrals) | Acquiring savers who actually fund the account | Users who arrive with a goal and money ready, under neutral ranking | Per funded account |

**Price anchors, not prices.** Set prices in the first conversations, anchored to what each payer already spends:

- **Licence:** the bank's current cost of activating a young customer. Salt Bank returned over 3 million lei in cashback in one 2024 referral campaign.
- **Referrals:** existing referral rewards. ProCredit pays 500 lei per referred *business* in 2026; retail savings will pay less.
- **Employers:** their per-employee benefits budget.

**Unit economics, as formulas to fill with pilot data:**

- Licence revenue per month = active learners × price per learner + platform fee ÷ 12.
- Referral revenue per month = users who see ranked options × click rate × funded rate × fee per funded account.
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
| Seen as investment advice | Education only: no personal product recommendations, guaranteed products in rankings, a lawyer's opinion in week 1 |
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

## Sources

Market and rule sources for the idea itself are in the "Young adults: Prima dată" tab. This plan adds:

- [Salt Bank: 330,000 clients and over 3 million lei cashback in its referral campaign](https://www.mobilissimo.ro/stiri-telefoane/salt-bank-incheie-anul-cu-330-000-de-clienti-si-3-milioane-lei-cashback-ce-pregateste-primul-neobank-romanesc-pentru-2025) — Mobilissimo, 17 Dec 2024
- [ProCredit "Parteneri de bancă": 500 lei per referred business](https://www.procreditbank.ro/wp-content/uploads/2026/04/Regulament-Campanie-Parteneri-de-banca-01.04.2026-–-31.07.2026.pdf) — ProCredit Bank, 2026
- [Zogo signs 200+ financial-institution partners](https://www.cuinsight.com/press-release/gen-z-targeted-zogo-app-reaches-milestone-signing-200-financial-institution-partners/) — CUInsight, 21 Jun 2022
- [Under-35s must join Pillar II within 4 months](https://www.mediafax.ro/?p=2532063) — Mediafax, 8 Apr 2008
