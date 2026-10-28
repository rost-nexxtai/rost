# Frontend MVP UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `frontend/` into the three-tab Romanian app from the MVP doc: quiz, Acasă, asset pages, Momente and Știri. Real API where it exists, typed fixtures and mock logic elsewhere.

**Architecture:**
- Next.js 16 App Router; server components by default.
- Every screen reads data through `frontend/src/data/index.ts`. Its functions call the real backend (`@/lib/api`) or return fixtures computed by pure functions in `data/mock/`.
- The mock profile lives in an httpOnly `rost_profile` cookie, written by server actions in `data/actions.ts`.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest 5 (new, frontend dev dependency), `next/font/google`, plain CSS with tokens, inline SVG.

**Spec:** `docs/superpowers/specs/2026-10-28-frontend-mvp-ui-design.md`

## Global Constraints

**Scope**
- Never create or edit files under `backend/`. Import from it only with `import type … from '@backend/contract'`.
- Fixture files and mock files say what they replace. Every file in `data/mock/` starts with `// MOCK until backend ships <endpoint>`.

**Copy and labels**
- All UI text is Romanian, with diacritics ă â î ș ț.
- The string "recomandat pentru tine" never appears anywhere in `frontend/src`.
- Example figures are labelled "exemplu". News impact is labelled "scenariu, nu prognoză". Historical ranges show their source and "în dolari, înainte de comisioane și taxe".
- Ranking never reads `isPartner`. Partners are labelled "Partener · putem primi un comision".

**Styling**
- Colour tokens exactly as in the spec: `--ground #F7F5F0`, `--surface #FFFFFF`, `--ink #16181D`, `--muted #5E6470`, `--line #E6E2DA`, `--primary #1F5A45`, `--primary-tint #E6EFEA`, `--accent #E8553A`, `--accent-tint #FCEAE5`.
- No gradients, no emoji, no chart library, no new runtime dependencies.
- Fonts come from `next/font/google`: Bricolage Grotesque for display, DM Sans for body, subsets `['latin','latin-ext']`. Use `tabular-nums` for amounts.
- Layout: max width 440px, 16px minimum side gutter, no horizontal scroll at 375px. Motion is off under `prefers-reduced-motion`.

**Behaviour**
- Money formatting is Romanian: `lei(1500) === '1.500 lei'`.
- Personal inflation: Maria 8.48%. Everyone else uses the national 6.61% (September 2026).

## Review Focus

1. **Broken cookie.** A corrupt, old or hand-edited `rost_profile` cookie must be treated as "no profile" (go to the quiz), never a 500. Test lives in Task 3.
2. **Backend down.** If the backend is unreachable, Acasă, asset pages and Știri still render from fixtures. Momente shows its library plus a "Nu ne putem conecta acum" card instead of crashing. Test lives in Task 8.
3. **Slider extremes.** Simulation sliders at their limits (0 lei, 0 monthly, 1 year, 40 years) must never produce NaN or Infinity in the chart. Tests live in Tasks 5 and 7.
4. **All "Nu știu".** A quiz answered "Nu știu" six times scores 0 → L0 and still produces a full Acasă. Test lives in Task 3.
5. **Session but no profile.** A user who has a backend session but no profile cookie (e.g. signed in before this change) is sent to `/quiz`, not looped back to `/`. Test lives in Task 3.

---

## File structure

```
frontend/
  vitest.config.mts                     NEW  test runner, '@' and '@backend' aliases
  package.json                          MOD  + vitest, "test" script
  src/app/
    layout.tsx                          MOD  fonts, lang="ro"
    globals.css                         REWRITE tokens + base components
    page.tsx                            MOD  landing (ro)
    quiz/page.tsx                       NEW
    acasa/page.tsx                      NEW
    active/[assetId]/page.tsx           NEW
    momente/page.tsx                    NEW
    moment/[runId]/page.tsx             MOD  (restyle via player)
    moment/lib/[momentId]/page.tsx      NEW
    stiri/page.tsx                      NEW
    profil/page.tsx                     NEW
    today/page.tsx                      REPLACE redirect('/momente')
    options/page.tsx                    REPLACE redirect('/acasa')
    onboarding/page.tsx                 REPLACE redirect('/quiz')
    simulator, metrics, embed, mock-bank  MOD  restyle + ro copy
  src/components/
    ui/        TabBar, TopBar, Card, RiskMeter, LevelBadge, ProgressBar, Money, SourceLink, Slider, Chip, SimChart, ApiDown, Icon
    quiz/      QuizFlow (client), QuizStep, QuizResult
    acasa/     AssetCard, FoundationCard
    assets/    ProviderRow, Simulation (client)
    momente/   MomentRow
    stiri/     NewsCard (client)
    moments/   MomentPlayer (MOD), LibraryMomentPlayer (NEW), steps/{Predict,Action,Card,Choice,AssetRange,Finish}Step
    ClientActions.tsx  MOD (DemoLogin sets profile; ro copy)
    Nav.tsx            DELETE (replaced by ui/TabBar, ui/TopBar)
  src/data/
    types.ts  index.ts  actions.ts
    fixtures/ assets.ts providers.ts brokers.ts news.ts quiz.ts moments.ts personas.ts
    mock/     scoring.ts ranking.ts simulation.ts acasa.ts momente.ts stiri.ts profile.ts  (+ *.test.ts)
  src/lib/format.ts  MOD  ro-RO formatting
.github/workflows/ci.yml  MOD  + npm test -w frontend
package-lock.json         NEW
README.md                 MOD
```

---

### Task 1: Frontend test harness, lockfile and CI

**Files:**
- Create: `frontend/vitest.config.mts`, `frontend/src/lib/format.test.ts`, `package-lock.json`
- Modify: `frontend/package.json`, `frontend/src/lib/format.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `npm test -w frontend`. `lei(n: number): string` and `pct(n: number, digits = 1): string`, both ro-RO. New: `leiSigned(n: number): string` returns e.g. `'+32 lei'` or `'−195 lei'` (U+2212 minus).

- [ ] **Step 1:** Add `vitest@^5.0.5` to `frontend` devDependencies and the script `"test": "vitest run"`.
  - Create `vitest.config.mts` with `test.include: ['src/**/*.test.ts']`, environment `node`.
  - Aliases: `'@'` → `./src`, `'@backend'` → `../backend/src`.
- [ ] **Step 2: Write the failing test** in `format.test.ts`:

```ts
expect(lei(1500)).toBe('1.500 lei');
expect(lei(32.4)).toBe('32 lei');
expect(pct(8.4812, 2)).toBe('8,48%');
expect(leiSigned(32)).toBe('+32 lei');
expect(leiSigned(-195.4)).toBe('−195 lei');
expect(leiSigned(0)).toBe('0 lei');
```

- [ ] **Step 3:** Run `npm install` from the repo root (this creates `package-lock.json`), then `npm test -w frontend`. Expected: FAIL. `lei` still gives `1,500 lei`, and `leiSigned` doesn't exist.
- [ ] **Step 4:** Update `format.ts` to use `Intl.NumberFormat('ro-RO')` and add `leiSigned`.
  - Set `useGrouping: 'always'`: ro-RO skips grouping for 4-digit numbers by default.
  - `pct` uses `minimumFractionDigits = maximumFractionDigits = digits`.
- [ ] **Step 5:** Run `npm test -w frontend`. Expected: PASS.
- [ ] **Step 6:** In `ci.yml`, after `npm test`, add `- run: npm test -w frontend`. Then run `npm ci && npm run typecheck`. Expected: exit 0.
- [ ] **Step 7: Commit**: `git add package-lock.json frontend .github && git commit -m "chore(frontend): vitest, ro-RO money format, lockfile for CI"`

---

### Task 2: Design tokens, fonts and app shell

**Files:**
- Rewrite: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`
- Create: the `frontend/src/components/ui/` files listed in the file structure, except `SimChart`, `Slider` and `ApiDown`, which come in later tasks.
- Delete: `frontend/src/components/Nav.tsx`. Update every importer of `Nav` and `TopBar` to `@/components/ui/TabBar` and `@/components/ui/TopBar`.
- Replace: `app/today/page.tsx` → `redirect('/momente')`, `app/options/page.tsx` → `redirect('/acasa')`, `app/onboarding/page.tsx` → `redirect('/quiz')`.

**Interfaces:**
- Produces:
  - `TabBar({ current: 'acasa' | 'momente' | 'stiri' })`
  - `TopBar({ profile?: { level: Level; riskProfile: RiskProfile } })`: the chip links to `/profil`.
  - `Card({ tone?: 'plain' | 'dark' | 'tint' | 'accent', children, className? })`
  - `RiskMeter({ value: 1|2|3|4|5 })`: renders `aria-label="Risc {value} din 5"`.
  - `LevelBadge({ level: Level })`: text `L0`/`L1`/`L2`.
  - `ProgressBar({ value: number, max: number, label: string })`
  - `Money({ lei: number, signed?: boolean, size?: 'sm' | 'md' | 'xl' })`
  - `SourceLink({ label: string, url: string, date?: string })`
  - `Chip({ pressed?: boolean, href?: string, onClick?, children })`
  - `Icon({ name: 'acasa'|'momente'|'stiri'|'chevron'|'external'|'back'|'check' })`: 24px inline SVG, `stroke="currentColor"`, 1.75 stroke width.
  - CSS classes for later tasks: `.shell`, `.stack`, `.row`, `.btn` (`-primary`, `-secondary`, `-ghost`, `-block`), `.eyebrow`, `.muted`, `.small`, `.note`, `.h1`, `.h2`, `.display-xl`, `.tag` (`-partner`, `-example`, `-scenario`), `.section-title`.
- Types `Level` and `RiskProfile` come from `@/data/types` (Task 3). Until Task 3 lands, declare them locally in `TopBar.tsx`, then switch the import in Task 3.

- [ ] **Step 1:** In `layout.tsx`, load `Bricolage_Grotesque` (weights 600, 800) and `DM_Sans` (400, 500, 700) from `next/font/google`.
  - Subsets `['latin','latin-ext']`; CSS variables `--font-display` and `--font-body`.
  - Set `<html lang="ro">` and remove the Google Fonts `<link>`.
  - Metadata title: `Rost: banii tăi, pe înțelesul tău`.
- [ ] **Step 2:** Rewrite `globals.css`.
  - The spec's tokens on `:root`; `--risk-1..5` = `#4E8A6A #8BA65A #D4A53A #CF7A3C #B5523B`.
  - `body` gets `background: var(--ground)` and `font-feature-settings: 'tnum'` on `.money`.
  - Radii: cards 20px, buttons pill-shaped.
  - Borders `1px solid var(--line)`. One shadow is allowed, on the tab bar: `0 -1px 0 var(--line)`.
  - Focus ring: `outline: 2px solid var(--primary); outline-offset: 2px`.
  - Add `@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important } }`.
  - Keep the existing class names used by the moment components (`.card`, `.bar`, `.stackbar`, `.swatch`, `.chip`, `.check`, `.grid3`, `.badge`, `.rank`) so nothing breaks before Task 11. Restyle them with the new tokens.
- [ ] **Step 3:** Build the `ui/` components to the interfaces above.
  - `TabBar` is fixed to the bottom with three items (icon above label: Acasă, Momente, Știri). It respects `env(safe-area-inset-bottom)`.
  - The active item is ink-coloured with a 3px accent bar above the icon, and has `aria-current="page"`.
- [ ] **Step 4:** Swap the `Nav`/`TopBar` imports in `simulator`, `metrics` and `today`. `today` is now a redirect, so it no longer imports them.
- [ ] **Step 5: Verify.**
  - `npm run typecheck -w frontend && npm run build -w frontend` → exit 0.
  - `grep -rn "components/Nav" frontend/src` → no output.
- [ ] **Step 6: Commit**: `feat(frontend): calm-paper tokens, self-hosted fonts, tab bar shell`

---

### Task 3: Data types, quiz scoring and profile cookie

**Files:**
- Create: `frontend/src/data/types.ts`, `data/fixtures/quiz.ts`, `data/fixtures/personas.ts`, `data/mock/scoring.ts`, `data/mock/scoring.test.ts`, `data/mock/profile.ts`, `data/mock/profile.test.ts`, `data/actions.ts`, `data/index.ts`

**Interfaces:**
- Produces (`types.ts`; every type gets a `/** proposed: <endpoint> */` comment):

```ts
export type Level = 0 | 1 | 2;
export type RiskProfile = 'prudent' | 'echilibrat' | 'dinamic';
export type AgeBand = 'sub_25' | '25_29' | '30_plus';
export type MoneyHorizon = 'sub_1_an' | '1_3_ani' | 'peste_3_ani';
export type KnowledgeAnswer = number | 'nu_stiu';
export type AssetId = 'cont_economii' | 'depozit' | 'titluri_stat' | 'etf' | 'actiuni' | 'aur';
export type Foundation = 'fond_urgenta' | 'datorii_scumpe' | null;
export interface MoneyLines { fuelLei: number; electricityLei: number; savedLei: number; inflationPct: number }
export interface Profile {
  name?: string; quizScore: number; quizLevel: Level; level: Level; riskProfile: RiskProfile;
  ageBand: AgeBand; situation: Situation; bufferMonths: number; expensiveDebt: boolean;
  horizon: MoneyHorizon; money: MoneyLines; completedMomentIds: string[];
}
export interface QuizAnswers {
  knowledge: KnowledgeAnswer[]; ageBand: AgeBand; situation: Situation; bufferMonths: number;
  expensiveDebt: boolean; horizon: MoneyHorizon;
  grossMonthly?: number; fuelLei?: number; electricityLei?: number; savedLei?: number;
}
```

  `Situation` is re-exported from `@backend/contract`, so the quiz can also create the real backend user. Later tasks add the rest of the spec's types (`AssetCard`, `AcasaResponse`, `Provider`, `AssetResponse`, `MomentSummary`, `MomenteResponse`, `NewsItem`, `StiriResponse`) to this same file.

- Produces (`mock/scoring.ts`):
  - `scoreKnowledge(answers: KnowledgeAnswer[]): number`: compares against `QUIZ.knowledge[i].correct`; `'nu_stiu'` and wrong answers score 0.
  - `levelFromScore(score: number): Level`: 0–2 → 0, 3–4 → 1, 5–6 → 2.
  - `riskProfile(i: { level: Level; ageBand: AgeBand; horizon: MoneyHorizon; bufferMonths: number; expensiveDebt: boolean }): RiskProfile`
  - `CORE_MOMENTS: Record<Level, string[]>` = `{0: ['fondul_urgenta','economii_vs_depozit','dobanda_compusa'], 1: ['titluri_stat','etf'], 2: ['actiuni','aur']}`
  - `levelWithMoments(quizLevel: Level, completed: string[]): Level`
  - `foundationFor(p: Pick<Profile,'bufferMonths'|'expensiveDebt'>): Foundation`
  - `profileFromQuiz(a: QuizAnswers, name?: string): Profile`. Money defaults: fuel 0, electricity 0, saved 0, inflationPct 6.61.
  - `entryRoute(hasSession: boolean, hasProfile: boolean): '/' | '/quiz' | '/acasa'`
- Produces (`mock/profile.ts`):
  - `PROFILE_COOKIE = 'rost_profile'`
  - `parseProfile(raw: string | undefined): Profile | undefined`: runs `JSON.parse` in try/catch and checks the shape of `level`, `riskProfile`, `money` and `completedMomentIds`.
  - `readProfile(): Promise<Profile | undefined>`: server only, uses `cookies()`.
- Produces (`actions.ts`, `'use server'`):
  - `saveQuiz(a: QuizAnswers): Promise<Profile>`
  - `setDemoProfile(persona: 'maria'): Promise<void>`
  - `completeLibraryMoment(momentId: string): Promise<Profile>`: adds the id and recomputes `level`.
  - `resetProfile(): Promise<void>`
  - Cookie options: httpOnly, sameSite lax, path `/`, maxAge 90 days.
- Produces (`index.ts`): `getProfile(): Promise<Profile | undefined>`, which re-exports `readProfile`.
- Fixtures:
  - `QUIZ.knowledge`: 6 items `{ id, question, options: string[], correct: number, explain: string }` on these topics: inflation and cash, compound interest, one stock vs an index ETF, tax on state bonds, bond prices when rates rise, what an ETF is. Romanian copy.
  - `QUIZ.profile`: answer options for age band, situation (Romanian labels for `student`/`graduate`/`employed`/`freelance`/`between_jobs`), buffer months options `[0, 1, 2, 3, 6]`, expensive debt yes/no, horizon.
  - `PERSONAS.maria`: name `Maria`, quizScore 4 → L1, ageBand `sub_25`, situation `employed`, bufferMonths 0.8, expensiveDebt false, horizon `peste_3_ani`, money `{ fuelLei: 400, electricityLei: 150, savedLei: 2500, inflationPct: 8.48 }`, completedMomentIds `[]`.

- [ ] **Step 1: Write the failing tests** in `scoring.test.ts`:

```ts
const all = (v: KnowledgeAnswer) => Array(6).fill(v);
const correct = QUIZ.knowledge.map((q) => q.correct);
const wrongAt = (n: number) => correct.map((c, i) => (i < n ? c : (c + 1) % QUIZ.knowledge[i].options.length));
expect(levelFromScore(scoreKnowledge(wrongAt(1)))).toBe(0);   // score 1 → L0
expect(levelFromScore(scoreKnowledge(correct))).toBe(2);      // score 6 → L2
expect(scoreKnowledge(all('nu_stiu'))).toBe(0);               // Review Focus 4
expect([2, 3, 4, 5].map(levelFromScore)).toEqual([0, 1, 1, 2]);
const base = { ageBand: 'sub_25', horizon: 'peste_3_ani', bufferMonths: 6, expensiveDebt: false } as const;
expect(riskProfile({ ...base, level: 0 })).toBe('echilibrat');           // 0+1 = 1
expect(riskProfile({ ...base, level: 2 })).toBe('dinamic');              // 2+1 = 3
expect(riskProfile({ ...base, level: 0, ageBand: '30_plus' })).toBe('prudent');
expect(riskProfile({ ...base, level: 2, horizon: 'sub_1_an' })).toBe('prudent');
expect(riskProfile({ ...base, level: 2, bufferMonths: 1 })).toBe('echilibrat');
expect(riskProfile({ ...base, level: 2, expensiveDebt: true })).toBe('echilibrat');
expect(levelWithMoments(0, ['fondul_urgenta', 'economii_vs_depozit'])).toBe(0);
expect(levelWithMoments(0, CORE_MOMENTS[0])).toBe(1);
expect(levelWithMoments(0, [...CORE_MOMENTS[0], ...CORE_MOMENTS[1]])).toBe(2);
expect(levelWithMoments(2, [])).toBe(2);                                 // quiz level is the floor
expect(foundationFor({ bufferMonths: 0.8, expensiveDebt: true })).toBe('fond_urgenta');
expect(foundationFor({ bufferMonths: 4, expensiveDebt: true })).toBe('datorii_scumpe');
expect(foundationFor({ bufferMonths: 3, expensiveDebt: false })).toBe(null);
expect(entryRoute(false, false)).toBe('/');
expect(entryRoute(true, false)).toBe('/quiz');                           // Review Focus 5
expect(entryRoute(true, true)).toBe('/acasa');
```

  In `profile.test.ts`:

```ts
expect(parseProfile(undefined)).toBeUndefined();
expect(parseProfile('garbage')).toBeUndefined();                          // Review Focus 1
expect(parseProfile(JSON.stringify({ level: 7 }))).toBeUndefined();
expect(parseProfile(JSON.stringify(PERSONAS.maria))).toEqual(PERSONAS.maria);
```

- [ ] **Step 2:** Run `npm test -w frontend`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement `types.ts`, the fixtures, `scoring.ts` and `profile.ts` to the interfaces above.
- [ ] **Step 4:** Run `npm test -w frontend`. Expected: PASS.
- [ ] **Step 5:** Implement `actions.ts` and `index.ts`.
  - `PERSONAS.maria` is defined as a full `Profile`, with `level` computed by `levelWithMoments`.
  - Run `npm run typecheck -w frontend` → exit 0.
- [ ] **Step 6: Commit**: `feat(frontend): profile types, mock quiz scoring and risk profile, profile cookie`

---

### Task 4: Landing, quiz flow and Profil

**Files:**
- Create: `app/quiz/page.tsx`, `components/quiz/QuizFlow.tsx` (`'use client'`), `components/quiz/QuizStep.tsx`, `components/quiz/QuizResult.tsx`, `app/profil/page.tsx`
- Modify: `app/page.tsx`, `components/ClientActions.tsx`

**Interfaces:**
- Consumes: `QUIZ`, `saveQuiz`, `setDemoProfile`, `resetProfile`, `getProfile`, `entryRoute`, `TopBar`, `Card`, `ProgressBar`, `LevelBadge`.
- Produces: routes `/quiz` and `/profil`. `DemoLogin` first calls the real `POST /api/users {demo:'maria'}`, then `setDemoProfile('maria')`, then navigates to `/acasa`.

- [ ] **Step 1: Landing `/`.**
  - Server-side: check `/api/me` and `getProfile()`, then `redirect(entryRoute(...))` unless the result is `'/'`. If the API call throws (backend down), treat it as no session.
  - Copy:
    - eyebrow "Banii tăi, pe înțelesul tău";
    - h1 "Află ce să faci cu banii tăi, pe cifrele tale.";
    - body "Un test de 2 minute îți arată de unde să începi. Apoi lecții scurte, pe salariul tău și pe știrile care îți mișcă banii.";
    - primary "Începe testul" → `/quiz`;
    - secondary `DemoLogin` "Continuă ca Maria (demo)";
    - note "Educație financiară, nu consultanță de investiții. Rost nu îți mută niciodată banii."
- [ ] **Step 2: `QuizFlow`.**
  - One question per screen. `ProgressBar` shows "Întrebarea {n} din {total}".
  - Back and Next buttons. Answers are kept in component state, so going back keeps them.
  - Knowledge questions always include "Nu știu" as the last option.
  - The last optional screen asks for gross salary, fuel/month, electricity/month and savings. Every field is optional, and there's a "Sari peste" (skip) button.
  - On submit:
    1. `POST /api/users` with `{ situations: [situation], grossMonthly }`, which creates the real session.
    2. Call `saveQuiz(answers)`.
    3. Show `QuizResult`.
  - If step 1 fails, still call `saveQuiz` and show a small note "Momentele declanșate vor apărea când serverul e disponibil".
- [ ] **Step 3: `QuizResult`.** Shows `LevelBadge`, the level name, the risk profile and a CTA.
  - Level names: L0 "Începător", L1 "Mediu", L2 "Avansat".
  - One line per risk profile:
    - prudent "Pui siguranța pe primul loc";
    - echilibrat "Un pic de risc, pentru mai mult randament";
    - dinamic "Accepți scăderi pe termen scurt".
  - If `foundationFor` isn't null, add the line "Întâi fundația: îți arătăm de unde să începi."
  - CTA "Mergi la Acasă" → `/acasa`.
- [ ] **Step 4: `/profil`.**
  - Shows level, risk profile, quiz score ("{score} din 6") and level progress.
  - Buttons:
    - "Refă testul" → `/quiz`;
    - "Resetează" → `resetProfile()`, then `DELETE /api/users`, then `/`.
  - A "Demo" card with links to `/simulator` and `/metrics`.
  - No profile → `redirect('/quiz')`.
- [ ] **Step 5: Verify.**
  - `npm run typecheck -w frontend && npm run build -w frontend` → exit 0.
  - Start both packages with `npm run dev`.
  - In the browser at 375×812:
    - the quiz with all "Nu știu" ends on L0;
    - "Continuă ca Maria" lands on `/acasa` (a 404 until Task 6 is fine);
    - Profil shows L1 · echilibrat.
- [ ] **Step 6: Commit**: `feat(frontend): landing, one-question-per-screen quiz, profile page`

---

### Task 5: Mock ranking and simulation

**Files:**
- Create: `data/fixtures/providers.ts`, `data/fixtures/brokers.ts`, `data/mock/ranking.ts`, `data/mock/ranking.test.ts`, `data/mock/simulation.ts`, `data/mock/simulation.test.ts`

**Interfaces:**
- Produces (types added to `types.ts`):

```ts
export interface SavingsProvider { id: string; assetId: 'cont_economii' | 'depozit' | 'titluri_stat'; name: string; product: string;
  kind: 'deposit' | 'state_bond'; grossRatePct: number; termMonths: number; accessRank: 1 | 2 | 3;
  isPartner: boolean; example: boolean; offerId?: string }
export interface Broker { id: string; name: string; country: 'RO' | 'EU'; commissionPct: number; minCommissionLei: number;
  spreadPct: number; isPartner: boolean; example: true }
export interface RankedProvider { id: string; rank: number; name: string; product: string; headline: string;
  netRatePct?: number; costLei?: number; accessRank?: 1 | 2 | 3; isPartner: boolean; example: boolean; offerId?: string }
export interface Point { year: number; valueLei: number }
export interface SimInput { startLei: number; monthlyLei: number; years: number }
```

- Produces (`ranking.ts`):
  - `netRatePct(p: Pick<SavingsProvider,'kind'|'grossRatePct'>): number`: deposit ×0.9, state bond unchanged; rounded to 2 decimals.
  - `rankSavings(list: SavingsProvider[]): RankedProvider[]`: by net rate descending, then `accessRank` ascending, then `name` ascending.
  - `brokerCostLei(b: Broker, amountLei = 1000): number` = `max(commissionPct/100 × amount, minCommissionLei) + spreadPct/100 × amount`.
  - `rankBrokers(list: Broker[]): RankedProvider[]`: by cost ascending, then name.
  - Headline formats: `"6,50% pe an, după impozit"` and `"3,50 lei la un ordin de 1.000 lei"`.
- Produces (`simulation.ts`):
  - `simulate(i: SimInput & { ratePct: number }): { value: Point[]; paidIn: Point[] }`: points for years 0..years. Each month: `v = v × (1 + ratePct/1200) + monthlyLei`. Values rounded to 2 decimals.
  - `todayMoney(value: Point[], inflationPct: number): Point[]`: `valueLei / (1 + inflationPct/100)^year`.
  - `simulateRange(i: SimInput, r: { worstPct: number; typicalPct: number; bestPct: number }): { worst: Point[]; typical: Point[]; best: Point[] }`
- Fixtures:
  - **Savings:**
    - `bank-d-savings` Bank D 3.8, access 1;
    - `bank-b-savings` Bank B 3.5, access 1, partner;
    - `bank-a-12m` 5.25, access 2;
    - `bank-b-12m` 4.8, partner;
    - `bank-c-12m` 4.4, partner;
    - `bank-a-36m` 5.0.
    - All `example: true`. `offerId` = the same id, which exists in the backend seed.
  - **State bonds** (real October 2026 values, `example: false`):
    - Tezaur 1y 6.50, 3y 7.00, 5y 7.50;
    - Fidelis lei 2y 6.60 and 5y 7.75.
    - `offerId` only on `tezaur-1y` and `fidelis-2y-lei`, the ids the backend seed has.
  - **Brokers:**
    - `broker-a` "Broker A (RO)": 0.5%, min 5, spread 0, partner;
    - `broker-b` "Broker B (UE)": 0%, min 1, spread 0.25;
    - `broker-c` "Broker C (UE)": 0.1%, min 2, spread 0.5.

- [ ] **Step 1: Write the failing tests**:

```ts
expect(netRatePct({ kind: 'deposit', grossRatePct: 5.25 })).toBe(4.73);
expect(netRatePct({ kind: 'state_bond', grossRatePct: 6.5 })).toBe(6.5);
const flipped = SAVINGS.map((p) => ({ ...p, isPartner: !p.isPartner }));
expect(rankSavings(flipped).map((r) => r.id)).toEqual(rankSavings(SAVINGS).map((r) => r.id)); // neutrality
expect(rankBrokers(BROKERS).map((b) => b.id)).toEqual(['broker-b', 'broker-a', 'broker-c']);   // 3.5 / 5 / 7
expect(rankBrokers(BROKERS.map((b) => ({ ...b, isPartner: !b.isPartner }))).map((b) => b.id))
  .toEqual(['broker-b', 'broker-a', 'broker-c']);
expect(simulate({ startLei: 1000, monthlyLei: 0, years: 1, ratePct: 6 }).value[1].valueLei).toBe(1061.68);
expect(simulate({ startLei: 0, monthlyLei: 100, years: 1, ratePct: 0 }).value[1].valueLei).toBe(1200);
expect(simulate({ startLei: 0, monthlyLei: 100, years: 2, ratePct: 5 }).paidIn[2].valueLei).toBe(2400);
expect(todayMoney([{ year: 1, valueLei: 1084.8 }], 8.48)[0].valueLei).toBeCloseTo(1000, 1);
// Review Focus 3: extremes stay finite
for (const s of [simulate({ startLei: 0, monthlyLei: 0, years: 40, ratePct: 7.5 }), simulate({ startLei: 1e6, monthlyLei: 1e4, years: 40, ratePct: 19.92 })])
  expect(s.value.every((p) => Number.isFinite(p.valueLei))).toBe(true);
expect(simulateRange({ startLei: 1000, monthlyLei: 0, years: 1 }, { worstPct: -0.19, typicalPct: 10.15, bestPct: 19.92 }).worst[1].valueLei).toBeLessThan(1000);
```

- [ ] **Step 2:** Run `npm test -w frontend`. Expected: FAIL.
- [ ] **Step 3:** Implement the fixtures, `ranking.ts` and `simulation.ts`. Nothing in `ranking.ts` may read `isPartner`; it is only copied through to the output.
- [ ] **Step 4:** Run `npm test -w frontend`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(frontend): mock neutral ranking and compound simulation with tests`

---

### Task 6: Acasă

**Files:**
- Create: `data/fixtures/assets.ts`, `data/mock/acasa.ts`, `data/mock/acasa.test.ts`, `components/acasa/AssetCard.tsx`, `components/acasa/FoundationCard.tsx`, `app/acasa/page.tsx`
- Modify: `data/types.ts`, `data/index.ts`

**Interfaces:**
- Produces (types):

```ts
export interface Asset { id: AssetId; name: string; oneLine: string; lessonLevel: Level; risk: 1|2|3|4|5;
  access: string; tax: string; whatItIs: string; momentId: string;
  simulation: { kind: 'fixed' } | { kind: 'range'; worstPct: number; typicalPct: number; bestPct: number;
    worstYear: { year: number; pct: number }; source: { label: string; url: string }; note?: string } }
export interface AssetCard { id: AssetId; name: string; oneLine: string; risk: 1|2|3|4|5; lessonLevel: Level;
  headline: string; aboveRiskProfile: boolean }
export interface AcasaResponse { profile: Profile; foundation: Foundation; forYourLevel: AssetCard[]; later: AssetCard[] } /** proposed: GET /api/acasa */
```

- Produces:
  - `ASSETS: Asset[]` in fixed order: cont_economii, depozit, titluri_stat, etf, actiuni, aur.
  - `buildAcasa(p: Profile): AcasaResponse`
  - `getAcasa(): Promise<AcasaResponse | undefined>`: returns `undefined` when there is no profile.
  - `maxRiskFor(r: RiskProfile): number`: prudent 2, echilibrat 3, dinamic 5. `aboveRiskProfile = risk > maxRiskFor(profile.riskProfile)`.
  - Headline:
    - fixed assets: the top `rankSavings` result for that `assetId`, e.g. "până la 7,50% pe an";
    - etf/actiuni: lowest `brokerCostLei`, "de la 3,50 lei / ordin";
    - aur: "randament istoric tipic 5,11%/an".
- Asset values come from the MVP table:

| id | lesson level | risk | simulation |
| --- | --- | --- | --- |
| cont_economii | 0 | 1 | fixed |
| depozit | 0 | 1 | fixed |
| titluri_stat | 1 | 1 | fixed |
| etf | 1 | 3 | range −0.19 / 10.15 / 19.92, worst year 2008 −40.33, source MSCI World https://en.wikipedia.org/wiki/MSCI_World |
| actiuni | 2 | 5 | same range plus note "O singură companie poate ajunge la zero; BET a pierdut 70% în 2008" |
| aur | 2 | 4 | range 0.47 / 5.11 / 14.61, worst year 2013 −28.3, source https://chartrow.com/gold/returns |

  Tax copy:
  - deposits and savings: "10% impozit pe dobândă";
  - state bonds: "fără impozit";
  - ETF/stocks/gold: "3% dacă ții peste un an, 6% sub un an (broker din România); 16% prin broker străin, în Declarația unică".

- [ ] **Step 1: Write the failing tests.** Test helpers: `answers: QuizAnswers = { knowledge: [], ageBand: 'sub_25', situation: 'employed', bufferMonths: 0.5, expensiveDebt: false, horizon: 'peste_3_ani' }`, with `allCorrect` and `wrongAtAll` built from `QUIZ.knowledge` as in Task 3.

```ts
const l0 = profileFromQuiz({ ...answers, knowledge: wrongAtAll });        // score 0
const l2 = profileFromQuiz({ ...answers, knowledge: allCorrect, bufferMonths: 6 });
expect(buildAcasa(l0).forYourLevel.map((a) => a.id)).toEqual(['cont_economii', 'depozit']);
expect(buildAcasa(l2).forYourLevel.map((a) => a.id)).toEqual(['cont_economii','depozit','titluri_stat','etf','actiuni','aur']);
expect(buildAcasa(l0).later.map((a) => a.id)).toEqual(['titluri_stat','etf','actiuni','aur']);
for (const level of [0, 1, 2] as const)
  expect(buildAcasa({ ...PERSONAS.maria, level, bufferMonths: 0.8 }).foundation).toBe('fond_urgenta');
expect(buildAcasa({ ...PERSONAS.maria, riskProfile: 'echilibrat' }).later.find((a) => a.id === 'actiuni')?.aboveRiskProfile).toBe(true);
const all = [...buildAcasa(l2).forYourLevel, ...buildAcasa(l2).later];
expect(all).toHaveLength(6);                                                // every asset shown at every level
expect(JSON.stringify(all).toLowerCase()).not.toContain('recomandat');
```

- [ ] **Step 2:** Run `npm test -w frontend`. Expected: FAIL.
- [ ] **Step 3:** Implement `assets.ts`, `acasa.ts` and `getAcasa`.
- [ ] **Step 4:** Run `npm test -w frontend`. Expected: PASS.
- [ ] **Step 5: Build the `/acasa` page.**
  - `TopBar` with the profile.
  - Greeting: h1 "Bună, {name}" or "Bună". Subtitle "Locurile unde îți poți ține sau crește banii, în ordinea în care merită să le înveți."
  - `FoundationCard` (accent tone) when needed:
    - fond_urgenta: "Întâi fundația: fondul de urgență". Body: "Ai bani pentru {bufferMonths} luni. Ținta: 3 luni de cheltuieli, într-un loc din care îi scoți oricând." CTA "Învață în 4 minute" → `/moment/lib/fondul_urgenta`.
    - datorii_scumpe: "Întâi fundația: datoriile scumpe". No moment yet, so the CTA is disabled and reads "în curând".
  - Section "Pentru nivelul tău", then section "Mai departe". Each "Mai departe" card shows "Lecția se deschide la L{lessonLevel}".
  - `AssetCard`: name, one line, `RiskMeter`, headline, a "Risc peste profilul tău" tag when flagged, and the link "Vezi opțiuni și simulare" → `/active/{id}`.
  - `TabBar current="acasa"`. No profile → `redirect('/quiz')`.
- [ ] **Step 6: Verify.**
  - `npm run build -w frontend` → exit 0.
  - In the browser as Maria: the foundation card is on top, "Pentru nivelul tău" lists 4 assets, "Mai departe" lists 2 with risk flags.
- [ ] **Step 7: Commit**: `feat(frontend): Acasă in learning order with foundation card`

---

### Task 7: Asset page with providers and simulation chart

**Files:**
- Create: `components/ui/SimChart.tsx`, `components/ui/SimChart.test.ts` (tests the exported `scaleY`), `components/ui/Slider.tsx`, `components/assets/ProviderRow.tsx`, `components/assets/Simulation.tsx` (`'use client'`), `app/active/[assetId]/page.tsx`
- Modify: `data/types.ts`, `data/index.ts`

**Interfaces:**
- Consumes: `ASSETS`, `rankSavings`, `rankBrokers`, `simulate`, `todayMoney`, `simulateRange`.
- Produces:
  - `AssetResponse { asset: Asset; providers: RankedProvider[]; inflationPct: number }` (`/** proposed: GET /api/assets/:id */`)
  - `getAsset(id: string): Promise<AssetResponse | undefined>`: `undefined` for an unknown id. The fixed simulation rate is `providers[0].netRatePct`.
  - `scaleY(value: number, max: number, height: number): number`: returns `height` when `max <= 0`.
  - `SimChart(props: { kind: 'fixed'; value: Point[]; paidIn: Point[]; today: Point[] } | { kind: 'range'; worst: Point[]; typical: Point[]; best: Point[] })`
  - `Slider({ label: string; min: number; max: number; step: number; value: number; onChange(v: number): void; format(v: number): string })`

- [ ] **Step 1: Write the failing test**:

```ts
expect(scaleY(0, 0, 160)).toBe(160);          // Review Focus 3: all-zero series
expect(scaleY(50, 100, 160)).toBe(80);
expect(Number.isFinite(scaleY(1e9, 1e9, 160))).toBe(true);
```

- [ ] **Step 2:** Run `npm test -w frontend`. Expected: FAIL.
- [ ] **Step 3: Implement `SimChart`.**
  - SVG `viewBox="0 0 320 180"`, `width="100%"`.
  - X axis = years. Y axis is scaled to the series max, with 3 gridlines labelled in compact lei ("10 mii", "1,2 mil").
  - **Fixed:** value line in `--primary` 2px, paid-in line in `--muted` dashed, today's-money line in `--accent` 1.5px.
  - **Range:** a band from worst to best filled `--primary-tint`, and the typical line in `--primary`.
  - The legend sits under the chart.
  - A `<p className="sr-only">` summary, e.g. "După {years} ani: {value}; ai depus {paidIn}".
- [ ] **Step 4:** Run `npm test -w frontend`. Expected: PASS.
- [ ] **Step 5: Build `Simulation`.**
  - Three sliders:
    - start amount 0–100,000 lei, step 500, default 5,000;
    - monthly amount 0–5,000, step 50, default 400;
    - years 1–40, default 10.
  - Big numbers above the chart:
    - **Fixed:** "Valoare după {years} ani", "Ai depus", "În banii de azi (inflația ta {pct})".
    - **Range:** "Scenariu slab / tipic / bun" with the three final values, plus the note "Un an ca {worstYear.year}: {worstYear.pct}%".
  - Source line: `SourceLink` plus "în dolari, înainte de comisioane și taxe".
- [ ] **Step 6: Build the `/active/[assetId]` page.**
  - Back link to `/acasa`, then name, `RiskMeter`, the "Ce este" (what it is) text, and Acces and Impozit rows.
  - Providers section titled "Unde găsești" (savings, deposits, bonds) or "Brokeri" (ETF/stocks/gold).
    - Gold uses brokers too.
    - Savings filters providers by `assetId`.
    - Footnote: "Ordinea vine dintr-o formulă publică: randament după impozit, apoi acces, apoi nume. Partenerii nu plătesc pentru poziție."
  - `ProviderRow`: rank circle, name and product, headline, `tag-partner` "Partener · putem primi un comision" or "Nu e partener", `tag-example` when `example`.
    - "Deschide" links to `/r/{offerId}` when `offerId` is set.
    - Otherwise the button is disabled and reads "Deschide (în curând)".
  - Simulation section, then a CTA "Vreau să aflu mai multe despre {name}" → `/moment/lib/{momentId}`.
  - Unknown id → a not-found card with a link back to `/acasa`.
- [ ] **Step 7: Verify.**
  - `npm run build -w frontend` → exit 0.
  - In the browser:
    - `/active/titluri_stat` ranks Fidelis 5y 7.75 first, then Tezaur 5y 7.50;
    - the sliders at 0/0/1 draw without NaN (check the console);
    - `/active/etf` shows the band;
    - "Deschide" on Bank B lands on the real mock bank.
- [ ] **Step 8: Commit**: `feat(frontend): asset page with neutral ranking and SVG simulation`

---

### Task 8: Momente

**Files:**
- Create: `data/fixtures/moments.ts`, `data/mock/momente.ts`, `data/mock/momente.test.ts`, `components/momente/MomentRow.tsx`, `components/ui/ApiDown.tsx`, `app/momente/page.tsx`
- Modify: `data/types.ts`, `data/index.ts`

**Interfaces:**
- Produces (types):

```ts
export type LibraryStep =
  | { type: 'choice'; question: string; options: string[]; correct: number; explain: string }
  | { type: 'predict'; question: string; answerValue: number; min: number; max: number; step: number; unit: string }
  | { type: 'card'; title: string; body: string }
  | { type: 'asset_range'; assetId: AssetId }
  | { type: 'finish'; cta: { label: string; href: string } };
export interface LibraryMoment { id: string; title: string; series: string; level: Level; core: boolean; minutes: number;
  assetIds: AssetId[]; steps: LibraryStep[] }  // steps empty → "în curând"
export interface MomentSummary { id: string; title: string; series: string; level: Level | null; core: boolean; minutes: number;
  status: 'open' | 'done' | 'todo' | 'soon'; href?: string }
export interface MomenteResponse { triggered: MomentSummary[]; forYourLevel: MomentSummary[]; rest: MomentSummary[];
  progress: { level: Level; coreDone: number; coreTotal: number; nextLevel: Level | null }; realApiDown: boolean } /** proposed: GET /api/momente */
```

- Produces:
  - `LIBRARY: LibraryMoment[]`: 7 entries with the `CORE_MOMENTS` ids. `fondul_urgenta` and `etf` have steps; the other 5 have `steps: []`.
  - `buildMomente(p: Profile, today: TodayResponse | undefined): MomenteResponse`:
    - triggered = `today.open` mapped to status `open`, href `/moment/{run.id}`, title from `today.moments`;
    - library moments with `level <= p.level` that aren't done → `forYourLevel`, sorted by level descending (your own level first), then library order;
    - everything else → `rest`, done ones marked `done`, empty-step ones `soon`;
    - `progress` counts `CORE_MOMENTS[p.level]` that are completed; `nextLevel` is `null` at L2;
    - `realApiDown = today === undefined`.
  - `getMomente(): Promise<MomenteResponse | undefined>`: calls the real `api<TodayResponse>('/api/today')` and catches every error into `undefined`, so `realApiDown` is set.
- Moment content (Romanian; the implementer writes the copy, the facts are fixed):
  - **`fondul_urgenta`** (L0, core, 4 min):
    1. choice "Unde ții fondul de urgență?" (correct: savings account with instant access);
    2. predict "Câte luni de cheltuieli ar trebui să acopere?" (answer 3, range 0–12);
    3. card on the target being 3 months of expenses, e.g. 2,500 lei × 3 = 7,500 lei;
    4. card on where to keep it: instant access, not investments;
    5. finish "Vezi conturile de economii" → `/active/cont_economii`.
  - **`etf`** (L1, core, 5 min): steps as in the MVP's JSON example:
    1. choice on what you buy with a global index ETF;
    2. predict on MSCI World 2008, `answerValue` −40.33 (range −60 to 20, unit `%`);
    3. `asset_range` etf;
    4. card "Costuri și impozit" with the tax line from Task 6;
    5. finish "Vezi ETF-urile" → `/active/etf`.
  - **"În curând"** (title, series, level, core):
    - `economii_vs_depozit` "Cont de economii sau depozit?" L0;
    - `dobanda_compusa` "Dobânda la dobândă" L0;
    - `titluri_stat` "Titluri de stat" L1;
    - `actiuni` "Acțiuni" L2;
    - `aur` "Aur și mărfuri" L2.

- [ ] **Step 1: Write the failing tests**:

```ts
const today = { open: [{ id: 'run1', momentId: 'payslip_explained', state: 'pending' }], moments: [{ id: 'payslip_explained', title: 'Your payslip, explained', series: 'Prima dată', minutes: 3 }] } as unknown as TodayResponse;
const m = buildMomente(PERSONAS.maria, today);
expect(m.triggered[0]).toMatchObject({ status: 'open', href: '/moment/run1' });
expect(m.forYourLevel.map((x) => x.id)).toEqual(['titluri_stat', 'etf', 'fondul_urgenta', 'economii_vs_depozit', 'dobanda_compusa']);
const l0 = { ...PERSONAS.maria, quizLevel: 0, level: 0 } as Profile;
expect(buildMomente(l0, today).forYourLevel.every((x) => x.level === 0)).toBe(true);
expect(buildMomente({ ...l0, completedMomentIds: ['fondul_urgenta'] }, today).progress).toEqual({ level: 0, coreDone: 1, coreTotal: 3, nextLevel: 1 });
const down = buildMomente(PERSONAS.maria, undefined);                    // Review Focus 2
expect(down.realApiDown).toBe(true);
expect(down.triggered).toEqual([]);
expect(down.forYourLevel.length).toBeGreaterThan(0);
```

  The expected order in the second assertion: Maria is L1, so her own level's core moments come first (`titluri_stat`, `etf`), then the not-done L0 core moments.

- [ ] **Step 2:** Run `npm test -w frontend`. Expected: FAIL.
- [ ] **Step 3:** Implement `moments.ts`, `momente.ts` and `getMomente`.
- [ ] **Step 4:** Run `npm test -w frontend`. Expected: PASS.
- [ ] **Step 5: Build the `/momente` page.**
  - h1 "Momente".
  - Progress card: "Nivelul {L}: {coreDone} din {coreTotal} lecții de bază", `ProgressBar`, and "Termină-le ca să treci la L{next}". At L2: "Ai ajuns la nivelul avansat".
  - Section "Acum, pentru tine" (triggered) with the dark card style. Hidden when empty.
  - When `realApiDown`, show `ApiDown` instead, with a retry that calls `router.refresh()`.
  - Sections "Pentru nivelul tău" and "Restul".
  - `MomentRow`: title, "{series} · {minutes} min", a "de bază" tag if core, and a status badge ("Gata", "În curând") or a chevron link.
  - No profile → `redirect('/quiz')`. `TabBar current="momente"`.
- [ ] **Step 6: Verify.**
  - `npm run build -w frontend` → exit 0.
  - In the browser: Simulator → "Salary received" → `/momente` shows the payslip moment at the top within 2 seconds.
  - Stop the backend: `/momente` shows the ApiDown card and the library.
- [ ] **Step 7: Commit**: `feat(frontend): Momente with triggered-first order and level progress`

---

### Task 9: Moment players and new step types

**Files:**
- Move: `components/moments/PredictStep.tsx` and `components/moments/ActionStep.tsx` → `components/moments/steps/`. Update their imports in `MomentPlayer` and `EmbedMoment`.
- Create: `components/moments/steps/CardStep.tsx`, `ChoiceStep.tsx`, `AssetRangeStep.tsx`, `FinishStep.tsx`, `components/moments/LibraryMomentPlayer.tsx` (`'use client'`), `app/moment/lib/[momentId]/page.tsx`
- Modify: `components/moments/MomentPlayer.tsx` (Romanian chrome, new styles, links `/today` → `/momente` and `/options` → `/active/cont_economii`), `PayslipReveal.tsx`, `InflationReveal.tsx`, `ScenarioSlider.tsx` (Romanian labels)

**Interfaces:**
- Consumes: `LibraryMoment`, `LibraryStep`, `completeLibraryMoment`, `getAsset`, `SimChart`, `simulateRange`.
- Produces:
  - `ChoiceStep({ question, options, correct, explain, onNext })`: after a pick, show correct/incorrect with `explain`, then a "Mai departe" button.
  - `CardStep({ title, body, onNext })`
  - `AssetRangeStep({ asset: Asset, onNext })`: a `SimChart` range for 1,000 lei over 10 years, plus the source.
  - `FinishStep({ cta, onFinish })`: calls `onFinish()`, then shows "Gata! {level-up line}" and the CTA link.
  - The level-up line comes from comparing `level` before and after `completeLibraryMoment`: "Ai trecut la L{n}" or "Încă {k} până la L{n}".
  - `PredictStep` gains an optional `reveal?: number`, which shows "Răspunsul: {value}{unit}" for library predicts, where the answer is local.

- [ ] **Step 1:** Move the step files and update the imports. Run `npm run typecheck -w frontend` → exit 0.
- [ ] **Step 2:** Build the new steps and `LibraryMomentPlayer`.
  - The header shows series · title, a "Închide" link to `/momente` and a progress bar.
  - A moment with `steps: []` renders "În curând" with a link back.
- [ ] **Step 3:** Add the page `/moment/lib/[momentId]`. It loads from `LIBRARY` and passes the asset for any `asset_range` step via `getAsset`. Unknown id → not-found card.
- [ ] **Step 4:** Translate `MomentPlayer` chrome (keep the backend content as-is):
  - "Închide", "Mai departe", "Gata. Revenim peste {n} zile.";
  - "O acțiune contează doar după ce ne spui că ai făcut-o.";
  - "Înapoi la Momente";
  - "Vezi unde îți poți ține economiile".
  - Translate the reveal and slider labels the same way.
- [ ] **Step 5: Verify.**
  - `npm run build -w frontend` → exit 0.
  - As an L0 user in the browser:
    - finishing `fondul_urgenta` shows "Încă 2 până la L1";
    - after visiting `/profil`, coreDone is 1;
    - the real payslip moment still plays end to end, and its action posts successfully.
- [ ] **Step 6: Commit**: `feat(frontend): library moment player with choice, range and finish steps`

---

### Task 10: Știri

**Files:**
- Create: `data/fixtures/news.ts`, `data/mock/stiri.ts`, `data/mock/stiri.test.ts`, `components/stiri/NewsCard.tsx` (`'use client'`), `app/stiri/page.tsx`
- Modify: `data/types.ts`, `data/index.ts`

**Interfaces:**
- Produces (types):

```ts
export type NewsImpact =
  | { kind: 'spend'; line: 'fuelLei' | 'electricityLei'; shock: { defaultPct: number; minPct: number; maxPct: number } }
  | { kind: 'savings'; alternative: { label: string; ratePct: number } };
export interface NewsItem { id: string; date: string; title: string; facts: string[];
  sources: { label: string; url: string; date: string }[]; impact: NewsImpact; momentId: string; momentHref: string }
export interface StiriResponse { items: (NewsItem & { monthlyLei: number })[]; money: MoneyLines } /** proposed: GET /api/stiri */
```

- Produces:
  - `spendImpactLei(spendLei: number, pct: number): number` = `Math.round(spendLei × pct / 100)`.
  - `savingsLossLei(savedLei: number, inflationPct: number, ratePct = 0): number` = `Math.round(savedLei × ((1 + ratePct/100)/(1 + inflationPct/100) − 1))`.
  - `buildStiri(p: Profile): StiriResponse`: `monthlyLei` is the spend impact at the default shock, or `|savingsLoss| / 12` for savings items. Items are sorted by `monthlyLei` descending.
  - `getStiri(): Promise<StiriResponse | undefined>`
- Fixtures: the three MVP items, with their facts, dated 28 Oct 2026, and the source URLs copied from the MVP doc's Știri table.
  - **`motorina`** — spend, fuel, shock 8% (0–25):
    - momentId `fondul_urgenta`, href `/moment/lib/fondul_urgenta`;
    - sources: the two Ziarul Profit links and the Wikipedia link.
  - **`electricitate`** — spend, electricity, shock 20% (0–35):
    - momentId `personal_inflation`, href `/momente` (it's a real backend moment, opened through triggers);
    - source: the Capital link.
  - **`bnr`** — savings, alternative "Tezaur 1 an" 6.50%:
    - momentId `titluri_stat`, href `/moment/lib/titluri_stat`;
    - source: the Bankingnews link.

- [ ] **Step 1: Write the failing tests**:

```ts
expect(spendImpactLei(400, 8)).toBe(32);
expect(spendImpactLei(150, 20)).toBe(30);
expect(savingsLossLei(2500, 8.48)).toBe(-195);
expect(savingsLossLei(2500, 8.48, 6.5)).toBe(-46);
expect(buildStiri(PERSONAS.maria).items.map((i) => i.id)).toEqual(['motorina', 'electricitate', 'bnr']);
const noCar = { ...PERSONAS.maria, money: { ...PERSONAS.maria.money, fuelLei: 0 } };
expect(buildStiri(noCar).items[2].id).toBe('motorina');                // exposure order
expect(spendImpactLei(0, 25)).toBe(0);
```

- [ ] **Step 2:** Run `npm test -w frontend`. Expected: FAIL.
- [ ] **Step 3:** Implement `news.ts`, `stiri.ts` and `getStiri`.
- [ ] **Step 4:** Run `npm test -w frontend`. Expected: PASS.
- [ ] **Step 5: Build `NewsCard`.**
  - Top: date and title, then the facts as a short list, then `SourceLink`s.
  - Then a tinted box "Ce înseamnă pentru tine":
    - **Spend items:** a slider labelled "Dacă prețul crește cu {pct}%" and the big `Money signed` value "+{x} lei/lună", recomputed live with `spendImpactLei`.
    - **Savings items:** "În cont curent: {loss} lei pe an" and "În {alternative}: {loss2} lei pe an". No slider.
  - The `tag-scenario` label "scenariu, nu prognoză".
  - Link "Află mai mult" → `momentHref`.
  - On the `/stiri` page:
    - h1 "Știri";
    - subtitle "Ce se întâmplă în lume și cât te costă, pe cifrele tale.";
    - note "Selectate și verificate de un editor. Nu facem predicții despre prețuri sau piețe.";
    - `TabBar current="stiri"`.
- [ ] **Step 6: Verify.**
  - `npm run build -w frontend` → exit 0.
  - As Maria in the browser: the cards are in order +32, +30, −195; dragging the fuel slider to 25% shows +100 lei/lună; every source link opens.
- [ ] **Step 7: Commit**: `feat(frontend): Știri with exposure order and live scenario sliders`

---

### Task 11: Restyle and translate the kept pages

**Files:**
- Modify: `app/simulator/page.tsx`, `app/metrics/page.tsx`, `app/embed/page.tsx`, `components/embed/EmbedMoment.tsx`, `app/mock-bank/[offerId]/page.tsx`, `components/ClientActions.tsx` (`CatchUpButton`, `FollowUp` copy)
- Test: `frontend/src/copy.test.ts`

**Interfaces:**
- Consumes: the `ui/` components.
- Produces: no new interfaces.

- [ ] **Step 1: Write the failing test** (`copy.test.ts`). It walks `src/` with `fs.readdirSync` (recursive) and checks that no `.ts`/`.tsx` file outside `*.test.ts` contains any of these strings: `'recomandat pentru tine'`, `'Back to today'`, `'Compare where to keep'`, `'Continue as Maria'`, `'Open the account'`, `'Fund it'`.
- [ ] **Step 2:** Run `npm test -w frontend`. Expected: FAIL; it lists the English strings still in the files.
- [ ] **Step 3: Translate and restyle each page.**
  - **Simulator:** "Simulator (demo)" plus the Romanian event labels. "Deschide ca [PARTNER BANK]" stays, since it's a placeholder name. Links point to `/momente`.
  - **Metrics:** Romanian labels; "Rata de acțiune" as the north star.
  - **Mock bank:** "Deschide contul", "Alimentează-l", and the Romanian fee sentences. The back link goes to `/acasa`.
  - **Embed:** Romanian chrome. Keep the partner theme variables.
  - **`FollowUp`:** "O săptămână mai târziu", "Da, gata", "Încă nu".
  - **`CatchUpButton`:** "Recuperează".
- [ ] **Step 4:** Run `npm test -w frontend`. Expected: PASS.
- [ ] **Step 5: Verify.**
  - `npm run build -w frontend` → exit 0.
  - In the browser: the referral from `/active/depozit` → mock bank → "Deschide contul" → "Alimentează-l" ends with a fee line on `/metrics`.
  - The partner view (from Simulator) renders in the bank theme.
- [ ] **Step 6: Commit**: `feat(frontend): Romanian copy and new styles on simulator, metrics, embed, mock bank`

---

### Task 12: README and full demo-path check

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: no new interfaces.

- [ ] **Step 1: Update `README.md`.**
  - **Quick start:** `npm install`, then `cp backend/.env.example backend/.env.local`, `cp frontend/.env.example frontend/.env.local`, then `npm run dev` (frontend on :3000, API on :4000).
  - **Layout:** a two-package section stating who owns what.
  - **Data:** a "Where data comes from" table (real vs fixtures), plus a pointer to `frontend/src/data/types.ts` for the proposed contracts.
  - **Demo script:** updated to the new path.
  - **Scripts:** update the scripts table.
  - Don't touch any backend file.
- [ ] **Step 2: Run the full check.** `npm ci && npm test && npm test -w frontend && npm run typecheck && npm run build` → all exit 0.
- [ ] **Step 3: Click through the demo path** in the in-app browser at 375×812 with `npm run dev`:
  1. landing;
  2. quiz with score 1 → L0 → Acasă order A;
  3. Resetează;
  4. quiz with score 6 → L2 → Acasă order B;
  5. Resetează;
  6. Maria → foundation card;
  7. `/active/titluri_stat` → simulation → "Deschide" Tezaur → mock bank funded;
  8. Momente → Simulator "Salary received" → payslip on top → play to the action;
  9. Știri slider;
  10. Profil.
  - Then confirm there is no horizontal scroll at 375px (`document.documentElement.scrollWidth <= 375`) and no console errors.
- [ ] **Step 4: Commit**: `docs: README for the two-package layout and new demo path`
