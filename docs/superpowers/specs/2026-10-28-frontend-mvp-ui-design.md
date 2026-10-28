# Frontend MVP UI: design

Oct 28, 2026 · frontend only (`frontend/`). The backend team owns `backend/`.

## Goal

Turn the frontend into the app described in `MVP & business plan.md` for the hackathon demo:

- three tabs: **Acasă**, **Momente**, **Știri**;
- the onboarding quiz that sets level (L0–L2) and risk profile;
- asset pages with ranked providers and a simulation chart;
- a mobile-first, Romanian UI that looks deliberate.

Success means the demo path in the MVP's "definition of done" works on a phone-width screen.

**Constraints**

- No code in `backend/`. The frontend imports only types from `backend/src/contract.ts`.
- Where the backend has no endpoint yet, the frontend uses typed fixtures and clearly marked mock logic.
- All UI text is in Romanian.
- The demo works offline. Fonts are self-hosted; fixtures need no network.
- No screen says "recomandat pentru tine" next to a financial instrument. Every simulated or example figure is labelled.

**Out of scope**

- Backend endpoints.
- Translating the three existing backend moments, whose content is English JSON in `backend/data/moments`.
- Writing all 7 new library moments: 2 are written here, 5 are listed as "în curând".
- Real broker referrals.

## Visual direction: "calm paper"

**Colour tokens** on `:root`:

| Token | Value | Use |
| --- | --- | --- |
| `--ground` | `#F7F5F0` | page background |
| `--surface` | `#FFFFFF` | cards |
| `--ink` | `#16181D` | text |
| `--muted` | `#5E6470` | secondary text |
| `--line` | `#E6E2DA` | 1px borders |
| `--primary` | `#1F5A45` | actions, positive figures |
| `--primary-tint` | `#E6EFEA` | |
| `--accent` | `#E8553A` | wordmark dot, highlighted numbers, active tab marker; used sparingly |
| `--accent-tint` | `#FCEAE5` | |
| `--risk-1` … `--risk-5` | muted green → amber → clay | risk meter |

**Rules**

- No gradients, no glassmorphism, no emoji icons. Borders instead of heavy shadows.
- **Type:** Bricolage Grotesque for headings and big numbers; DM Sans for body text. Both are loaded with `next/font/google`, which self-hosts them, with the latin-ext subset for ă â î ș ț. Use `font-variant-numeric: tabular-nums` for amounts.
- **Layout:** one column, max 440px, 16–20px gutters. On desktop the column is centred.
- **Motion:** short opacity and transform transitions only, disabled under `prefers-reduced-motion`.
- **Icons:** hand-drawn inline SVG (tab icons, chevrons, external link).
- **Charts:** SVG, no chart library.

## Navigation and routes

- **Bottom tab bar:** Acasă · Momente · Știri.
- **Top bar:** the `rost.` wordmark, plus a level chip ("L1 · echilibrat") that links to `/profil`.
- **Demo tools:** Simulator and Metrics are linked only from a "Demo" section in Profil.

| Route | Screen | Data |
| --- | --- | --- |
| `/` | Landing: "Începe testul", "Continuă ca Maria (demo)" | real `/api/me` (redirect when signed in) |
| `/quiz` | One question per screen with a progress bar; result screen with level and risk profile | fixtures + mock scoring |
| `/acasa` | "Întâi fundația" (when needed) → "Pentru nivelul tău" → "Mai departe" | fixtures + mock profile |
| `/active/[assetId]` | What it is, risk, access, 2026 tax; ranked providers; simulation; "Vreau să aflu mai multe despre …" | fixtures + mock ranking/simulation |
| `/momente` | Triggered (real open runs) → for your level → the rest; level progress | real `/api/today` + fixture library |
| `/moment/[runId]` | Existing player for real runs, restyled | real |
| `/moment/lib/[momentId]` | Player for fixture library moments | fixtures |
| `/stiri` | 3 news cards with sources, dates and a lei-a-month slider | fixtures |
| `/profil` | Level, risk profile, retake quiz, reset, Demo links | mock profile |
| `/simulator`, `/metrics`, `/embed`, `/mock-bank/[offerId]`, `/r/[offerId]` | Kept, restyled and translated | real |
| `/today` → `/momente`, `/options` → `/acasa` | Redirects | — |

## Data layer (`frontend/src/data/`)

Components import only from `data/index.ts`.

```
data/
  types.ts        proposed response types, each tagged with its proposed endpoint
  index.ts        one async function per screen: getAcasa, getAsset, getMomente, getStiri, getProfile, saveQuiz, ...
  fixtures/
    assets.ts     6 assets: name, lesson level, risk, access, tax, simulation basis, moment id
    providers.ts  savings/deposit/state-bond offers (same example banks and Tezaur/Fidelis rates as backend seed) + 3 example brokers
    news.ts       the 3 Știri items from the MVP doc, with real source links and dates
    quiz.ts       6 knowledge questions + 5 profile questions + optional salary/spending
    moments.ts    library moments: fondul_urgenta and etf written in Romanian; 5 more as "în curând"
    personas.ts   Maria (L1, 0.8 months buffer), an L0 and an L2 persona
  mock/           every file starts with "MOCK until backend ships <endpoint>"
    scoring.ts    quiz → level, risk profile with caps
    ranking.ts    net rate after tax; broker cost per 1,000 lei
    simulation.ts monthly compounding series
    profile.ts    read/write the rost_profile cookie
```

Switching a screen to the real API means changing one function body in `index.ts`. When the backend team agrees a shape, it moves from `types.ts` to `backend/src/contract.ts`.

### Proposed types

| Type | Fields | Proposed endpoint |
| --- | --- | --- |
| `Profile` | level, quizLevel, riskProfile (`prudent`/`echilibrat`/`dinamic`), ageBand, bufferMonths, expensiveDebt, horizon, completedMomentIds | `GET /api/me` (extend) |
| `QuizAnswers` | knowledge[6] (index or `nu_stiu`), ageBand, situation, bufferMonths, expensiveDebt, horizon, optional gross/payday/hireDate/spending | `POST /api/quiz` |
| `AssetCard` | id, name, oneLine, risk, lessonLevel, headline (best net rate or lowest cost), aboveRiskProfile | — |
| `AcasaResponse` | profile, foundation (`emergency_fund` / `expensive_debt` / null), forYourLevel[], later[] | `GET /api/acasa` |
| `Provider` | id, name, product, netRatePct or costLei, accessRank, isPartner, example, offerId (for referral) | — |
| `AssetResponse` | asset details, providers[] (ranked), simulation basis (`fixed` with ratePct, or `range` with worst/typical/best yearly %, worst year and source), momentId | `GET /api/assets/:id` |
| `MomentSummary` | id, title, series, level, core, minutes, status (`open`/`done`/`todo`/`soon`), runId? | — |
| `MomenteResponse` | triggered[], forYourLevel[], rest[], progress {level, coreDone, coreTotal, nextLevel} | `GET /api/momente` |
| `NewsItem` | id, date, title, facts[], sources[{label,url,date}], spendLine, monthlySpendLei, shock {default,min,max}, momentId | `GET /api/stiri` |
| `StiriResponse` | items[] ordered by the user's exposure | `GET /api/stiri` |

### Mock rules (from the MVP doc)

- **Level:** knowledge score 0–2 → L0, 3–4 → L1, 5–6 → L2. "Nu știu" scores 0.
- **Level from moments:** the higher of the quiz level and the highest level whose lower-level core moments are all done. Core moments: L0 = emergency fund, savings vs deposit, compound interest. L1 = state bonds, ETFs. L2 = stocks, gold.
- **Risk profile:** level + 1 if under 30. 0 → prudent, 1–2 → echilibrat, 3 → dinamic. Two caps:
  - money needed within a year → prudent;
  - buffer under 3 months or expensive debt → at most echilibrat.
- **Acasă order:**
  - fixed asset order: savings account, deposit, state bonds, ETFs, stocks, gold;
  - "Pentru nivelul tău" = lesson level ≤ user level;
  - "Mai departe" = the rest, each marked with the level that unlocks its lesson.
- **Foundation card:** when the buffer is under 3 months, the emergency-fund card shows first at any level; otherwise expensive debt shows if the user has any.
- **Ranking:**
  - savings, deposits and bonds: by net rate (deposits × 0.9, state bonds untaxed), then access, then name;
  - brokers: by `max(commission% × 1000, min commission) + spread% × 1000`, then name;
  - partner status is never an input.
- **Simulation:**
  - start amount + monthly amount, compounded monthly at the yearly rate, sampled per year;
  - fixed products also show total paid in and the value in today's money at the user's inflation (8.48% for Maria, 6.61% national otherwise);
  - market assets run three times (worst, typical, best).

### Mock state

- **Cookie:** `rost_profile` holds JSON `Profile`. It is written by server actions (quiz submit, library-moment completion, reset) and read by server components. It is httpOnly, `sameSite=lax`.
- **Demo login:** "Continuă ca Maria" calls the real `POST /api/users {demo:"maria"}` and sets Maria's fixture profile.
- **Reset:** Profil → "Resetează" clears the cookie.

### Real vs mock

| Real API (exists today) | Fixtures + mock |
| --- | --- |
| session, demo login, moment runs and player, follow-ups, simulator, clock, calendar, partner view, referral click → mock bank → funded, metrics | quiz, profile, Acasă, asset pages, Știri, level progress, library moments |

**Referrals:**

- Provider rows with an `offerId` that exists in the backend seed link to the real `/r/[offerId]`.
- Broker rows show "Deschide (în curând)" and make no fake click.

## Components (`frontend/src/components/`)

**`ui/`:**

- **Layout:** `TabBar`, `TopBar`, `Card`.
- **Indicators:** `RiskMeter`, `LevelBadge`, `ProgressBar`.
- **Content:** `Money`, `SourceLink`.
- **Inputs:** `Slider`, `Chip`.
- **`SimChart`:** fixed = one line plus a paid-in line; range = band plus typical line plus a "un an ca 2008" note. Each chart has a text summary for screen readers.

**Feature components:** `acasa/AssetCard`, `acasa/FoundationCard`, `assets/ProviderRow`, `assets/Simulation`, `stiri/NewsCard`, `momente/MomentRow`, `quiz/QuizStep`, `quiz/QuizResult`.

**Moment player:**

- Step renderers live in `components/moments/steps/`: predict, reveal, card and action (existing), plus choice, asset_range and finish (new).
- `MomentPlayer` keeps the real-run flow.
- `LibraryMomentPlayer` reuses the renderers and calls a server action on finish.

## Errors and empty states

- **No session** on a tab screen → redirect to `/`.
- **Real API unreachable** → a calm card "Nu ne putem conecta acum" with "Încearcă din nou". Fixture-backed sections still render.
- **Unknown asset or moment** → not-found card with a link back.
- **Labels:** example rates "exemplu"; news impact "scenariu, nu prognoză"; historical ranges name their source and say "în dolari, înainte de comisioane și taxe".

## Testing

- Vitest is added to `frontend/` (dev dependency). Tests live next to the mock files and cover:
  - quiz scores 1 and 6 → L0 and L2, and the Acasă order differs;
  - buffer under 3 months → "Întâi fundația" first at L0, L1 and L2;
  - ranking order is identical with partner flags on or off;
  - simulation matches hand-checked values (e.g. 1,000 lei at 6% for 1 year, monthly compounding → 1,061.68);
  - Maria: fuel 400 lei × 8% → 32 lei/month;
  - 3 L0 core moments done → level becomes L1;
  - no fixture or copy string contains "recomandat pentru tine".
- `npm run typecheck` and `npm run build` pass for the frontend.
- **Manual check** in the in-app browser at 375px width, with the real backend running:
  - landing → quiz → Acasă → asset page → referral → mock bank funded → Momente → real payslip moment via simulator → Știri slider → Profil reset.

## Housekeeping

- Regenerate the root `package-lock.json` so CI's `npm ci` works. Add the frontend test to CI.
- Update `README.md`: two packages, `npm run dev` starts both, env files per package, where fixtures live.

## Build order

1. Tokens, fonts, shell, tab bar, top bar, redirects.
2. Data layer skeleton, quiz, profile cookie, Profil.
3. Acasă.
4. Asset page, providers, SimChart.
5. Momente, library player and new step types.
6. Știri.
7. Restyle and translate landing, the player, simulator, metrics, embed and mock bank.
8. Tests, lockfile, README, browser check.
