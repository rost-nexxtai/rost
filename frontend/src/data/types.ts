/**
 * Response shapes the frontend expects for screens the backend doesn't serve yet.
 * Each one notes the endpoint we're proposing. When the backend team agrees a shape,
 * it moves to src/contract.ts (and the Go handler) and data/index.ts switches to the real call.
 */
import type { Action, Situation } from '@/contract';

export type { Situation };

export type Level = 0 | 1 | 2;
export type RiskProfile = 'prudent' | 'echilibrat' | 'dinamic';
export type AgeBand = 'sub_25' | '25_29' | '30_plus';
export type MoneyHorizon = 'sub_1_an' | '1_3_ani' | 'peste_3_ani';
export type KnowledgeAnswer = number | 'nu_stiu';
export type AssetId = 'cont_economii' | 'depozit' | 'titluri_stat' | 'etf' | 'actiuni' | 'aur';
export type Foundation = 'fond_urgenta' | 'datorii_scumpe' | null;

/** Monthly money lines the Știri items read. inflationPct is personal when known, else national. */
export interface MoneyLines {
  fuelLei: number;
  electricityLei: number;
  savedLei: number;
  inflationPct: number;
  /** Lines the user has answered. An answered 0 ("I have no car") is real; an unanswered 0 means "ask". */
  known?: MoneyLine[];
  /** Monthly spending, from Profil → "Banii tăi". Missing means we use a default and say so. */
  expensesLei?: number;
  /** True when inflationPct is the user's own (from their spending mix), not the national figure. */
  inflationPersonal?: boolean;
}

export type MoneyLine = 'fuelLei' | 'electricityLei' | 'savedLei';

/** proposed: GET /api/me (extend the user with this profile) */
export interface Profile {
  name?: string;
  quizScore: number;
  quizLevel: Level;
  /** max(quiz level, level earned from completed core moments) */
  level: Level;
  riskProfile: RiskProfile;
  ageBand: AgeBand;
  situation: Situation;
  bufferMonths: number;
  expensiveDebt: boolean;
  horizon: MoneyHorizon;
  money: MoneyLines;
  completedMomentIds: string[];
  /** Lessons started and left before the end, by id: where to pick up. */
  lessonProgress?: Record<string, LessonProgress>;
  /** Recent days (YYYY-MM-DD, Romanian time) with a finished lesson, oldest first. */
  learnedDays?: string[];
}

/** A lesson left halfway: the screen to resume on and the graded answers so far. */
export interface LessonProgress {
  step: number;
  results: boolean[];
  /** How many screens the lesson had, so a lesson edited since starts over. */
  of: number;
}

/** proposed: POST /api/quiz. Onboarding asks age, situation, buffer, debt and up to four knowledge questions (two per tier). */
export interface QuizAnswers {
  knowledge: KnowledgeAnswer[];
  ageBand: AgeBand;
  situation: Situation;
  bufferMonths: number;
  /** Not asked at onboarding yet; defaults to false. */
  expensiveDebt?: boolean;
  /** Not asked at onboarding yet; defaults to 1–3 years, which never lifts the risk profile. */
  horizon?: MoneyHorizon;
  grossMonthly?: number;
  fuelLei?: number;
  electricityLei?: number;
  savedLei?: number;
}

/**
 * One real provider on an asset page, from GET /api/providers/:assetId. The list links to each
 * provider's official site. Partners are labelled, and nobody pays for a position.
 */
export interface RankedProvider {
  id: string;
  rank: number;
  name: string;
  product: string;
  /** "6,30% pe an, după impozit" or "5,00 lei la un ordin de 1.000 lei" */
  headline: string;
  netRatePct?: number;
  costLei?: number;
  accessRank?: 1 | 2 | 3;
  conditions: string[];
  /** Brokers only: who pays the tax on gains, and how much. */
  taxNote?: string;
  /** The provider's official site. */
  url?: string;
  /** "oct. 2026": when the rate or fee was last checked. */
  checked?: string;
  source?: { label: string; url: string };
  /** "5,1 mil. clienți în România", when known. */
  clientsLine?: string;
  /** Marked as a partner in the admin page: shown as a label, never used for the order. */
  isPartner?: boolean;
}

export interface Point {
  year: number;
  valueLei: number;
}

export interface SimInput {
  startLei: number;
  monthlyLei: number;
  years: number;
}

export type AssetSimulation =
  | { kind: 'fixed' }
  | {
      kind: 'range';
      worstPct: number;
      typicalPct: number;
      bestPct: number;
      worstYear: { year: number; pct: number };
      source: { label: string; url: string };
      note?: string;
    };

export interface Asset {
  id: AssetId;
  name: string;
  oneLine: string;
  lessonLevel: Level;
  risk: 1 | 2 | 3 | 4 | 5;
  access: string;
  tax: string;
  whatItIs: string;
  momentId: string;
  simulation: AssetSimulation;
}

export interface AssetCard {
  id: AssetId;
  name: string;
  oneLine: string;
  risk: 1 | 2 | 3 | 4 | 5;
  lessonLevel: Level;
  headline: string;
  aboveRiskProfile: boolean;
}

/** proposed: GET /api/acasa */
export interface AcasaResponse {
  profile: Profile;
  foundation: Foundation;
  forYourLevel: AssetCard[];
  later: AssetCard[];
}

/** proposed: GET /api/assets/:id */
export interface AssetResponse {
  asset: Asset;
  /** Ranked by the public formula: savings by net rate after tax, brokers by the cost of a 1,000 lei order. */
  providers: RankedProvider[];
  providerKind: 'savings' | 'brokers';
  /** The user's inflation (personal when known), for "in today's money". */
  inflationPct: number;
  /** True when inflationPct comes from the user's own spending mix. */
  inflationPersonal: boolean;
  /** What the user said they have saved, so the simulation starts there. */
  savedLei?: number;
  /** The backend couldn't be reached, so there are no providers to show. */
  providersDown?: boolean;
}

/** Hands-on calculators a lesson can embed (components/lesson/widgets.tsx). */
export type LessonWidget = 'fund_builder' | 'compound' | 'savings_vs_deposit' | 'diversify' | 'bonds_vs_deposit';

/**
 * One screen of a lesson, one idea each. choice, predict, sort and order are graded; explore, stat
 * and asset_range are not. Keep text to a sentence or two: the interaction carries the lesson.
 */
export type LibraryStep =
  | { type: 'choice'; question: string; options: string[]; correct: number; explain: string }
  | { type: 'predict'; question: string; answerValue: number; acceptRange?: [number, number]; min: number; max: number; step: number; unit: string; start?: number; explain?: string }
  | { type: 'sort'; question: string; buckets: [string, string]; items: { label: string; bucket: 0 | 1; /** One line shown when this card is sorted wrong. */ why?: string }[]; explain: string }
  /** `ordered` is the right order, top to bottom; the app shuffles it and the user drags it back. */
  | { type: 'order'; question: string; ordered: string[]; top: string; bottom: string; explain: string }
  | { type: 'explore'; title: string; body?: string; widget: LessonWidget }
  | { type: 'stat'; value: string; label: string; body?: string }
  | { type: 'asset_range'; assetId: AssetId }
  | { type: 'finish'; cta: { label: string; href: string } };

/** A lesson from the library. Empty steps means it isn't written yet ("în curând"). */
export interface LibraryMoment {
  id: string;
  title: string;
  /** One line that says why it's worth three minutes. */
  hook: string;
  series: string;
  level: Level;
  core: boolean;
  minutes: number;
  assetIds: AssetId[];
  steps: LibraryStep[];
  /** Shown on the finish screen. */
  takeaways: string[];
}

export interface MomentSummary {
  id: string;
  title: string;
  /** Library lessons: one line on why it's worth the minutes. */
  hook?: string;
  series: string;
  /** null for event-triggered moments (payslip, inflation, what-if), which aren't tied to a level. */
  level: Level | null;
  core: boolean;
  minutes: number;
  status: 'open' | 'done' | 'todo' | 'soon' | 'started';
  href?: string;
  /** Library lessons left halfway: the screen to resume on (1-based) out of how many. */
  progress?: { step: number; of: number };
  /** Set for a real backend moment the user can open now with a "catch up" tap. */
  catchUpMomentId?: string;
  /** The catch-up needs a gross salary first (the payslip moment, for someone who never gave one). */
  catchUpNeedsSalary?: boolean;
}

/** proposed: GET /api/momente */
export interface MomenteResponse {
  triggered: MomentSummary[];
  forYourLevel: MomentSummary[];
  rest: MomentSummary[];
  progress: { level: Level; coreDone: number; coreTotal: number; nextLevel: Level | null };
  /** Real 7-day checks that are due (from GET /api/today). */
  dueFollowUps: Action[];
  /** True when the real API couldn't be reached: triggered moments are unknown, the library still shows. */
  realApiDown: boolean;
}

export type NewsImpact =
  | { kind: 'spend'; line: 'fuelLei' | 'electricityLei'; shock: { defaultPct: number; minPct: number; maxPct: number } }
  | { kind: 'savings'; alternative: { label: string; ratePct: number } };

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  facts: string[];
  sources: { label: string; url: string; date: string }[];
  impact: NewsImpact;
  momentId: string;
  momentHref: string;
}

/** proposed: GET /api/stiri. Items are ordered by the user's own exposure (lei a month). */
export interface StiriResponse {
  items: (NewsItem & { monthlyLei: number })[];
  money: MoneyLines;
}
