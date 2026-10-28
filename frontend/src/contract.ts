/**
 * The API contract: every request and response body the Go backend (backend/) speaks.
 * Types only, no runtime code. Change a shape here and in the Go handler together
 * (backend/internal/server); the Go JSON tags use the same field names.
 */

import type { Level, LibraryMoment, MomenteResponse, NewsItem, Profile, QuizAnswers, RiskProfile, StiriResponse } from './data/types';

// ---- Domain records ----

export type Situation = 'student' | 'graduate' | 'employed' | 'freelance' | 'between_jobs';
export type FirstDone = 'payslip' | 'savings' | 'investing' | 'freelance' | 'tax_return';

export type EventType =
  | 'salary_received'
  | 'payslip_uploaded'
  | 'pillar2_deadline_near'
  | 'inflation_published'
  | 'shock_scenario'
  | 'graduated'
  | 'raise'
  | 'catch_up';

export type EventSource = 'simulator' | 'calendar' | 'bank' | 'user' | 'editor';

/** Spending shares (or rates) in INS's three main groups. */
export interface CategoryShares {
  services: number;
  nonFood: number;
  food: number;
}

export interface SpendingProfile {
  shares: CategoryShares;
  /** Monthly lei for lines a scenario can shock. */
  monthly: { fuel?: number; utilities?: number; food?: number };
  source: 'self' | 'bank';
}

export interface User {
  id: string;
  name?: string;
  situations: Situation[];
  payday?: number;
  hireDate?: string;
  grossMonthly?: number;
  lastRaiseDate?: string;
  monthlyExpenses?: number;
  firstsDone: FirstDone[];
  spending?: SpendingProfile;
  /** after the quiz */
  quiz?: QuizProfile;
  /** never goes down */
  levelEarned: Level;
  createdAt: string;
}

export interface QuizProfile {
  score: number;
  level: Level;
  ageBand: string;
  situation: string;
  bufferMonths: number;
  expensiveDebt: boolean;
  horizon: string;
  fuelLei: number;
  electricityLei: number;
  savedLei: number;
  takenAt: string;
}

export interface AppEvent {
  id: string;
  userId: string;
  type: EventType;
  payload: Record<string, unknown>;
  source: EventSource;
  createdAt: string;
}

export type RunState = 'pending' | 'started' | 'completed' | 'dismissed';

export interface MomentRun {
  id: string;
  userId: string;
  momentId: string;
  triggerEventId?: string;
  state: RunState;
  guess?: number;
  result?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type ActionStatus = 'set' | 'confirmed' | 'skipped';

export interface Action {
  id: string;
  userId: string;
  momentRunId: string;
  type: string;
  params: Record<string, unknown>;
  status: ActionStatus;
  followUpAt: string;
  createdAt: string;
}

export type ReferralStatus = 'clicked' | 'opened' | 'funded';

export interface Referral {
  id: string;
  clickId: string;
  userId?: string;
  offerId: string;
  partnerId?: string;
  status: ReferralStatus;
  feeLei: number;
  createdAt: string;
  updatedAt: string;
}

// ---- Moments ----

export type Step =
  | { type: 'predict'; question: string; answer: string; min: number; max: number; step: number; unit: string; start?: number }
  | { type: 'reveal'; view: 'payslip' | 'personal_inflation' | 'scenario' }
  | { type: 'card'; title: string; body: string; link?: { label: string; href: string } }
  | { type: 'action'; action: string; title: string; body: string; options: number[]; defaultOption: number | null };

export interface MomentDefinition {
  id: string;
  series: string;
  title: string;
  minutes: number;
  /** Events that can open this moment. `catch_up` (user-initiated) can open any moment. */
  triggers: EventType[];
  /** Events that may open it again after it was completed. */
  repeatOn?: EventType[];
  conditions: {
    situations?: Situation[];
    requires?: ('grossMonthly' | 'spending' | 'hireDate' | 'monthlyExpenses')[];
  };
  steps: Step[];
  followUpDays: number;
}

export type SkipReason = 'not_triggered' | 'situation' | 'missing_data' | 'already_done' | 'already_open' | 'weekly_cap';

export interface Decision {
  open: string[];
  skipped: { momentId: string; reason: SkipReason }[];
}

// ---- Rules and views ----

export interface PayslipBreakdown {
  gross: number;
  /** Total pension contribution (CAS, 25% of gross). */
  pension: number;
  /** Part of CAS that goes into the employee's own Pillar II account. */
  pillar2: number;
  /** Part of CAS that funds today's pensions and earns the employee pension points. */
  publicPension: number;
  /** Health contribution (CASS, 10%). */
  health: number;
  personalDeduction: number;
  incomeTax: number;
  net: number;
  rulesYear: number;
}

export interface PersonalInflation {
  /** Personal 12-month inflation, percent. */
  personalPct: number;
  /** Percentage points each group adds to the personal figure. */
  contributions: CategoryShares;
  /** Shares after normalising to sum to 1. */
  shares: CategoryShares;
}

export interface Scenario {
  id: string;
  title: string;
  context: string;
  spendLine: 'fuel' | 'utilities' | 'food';
  defaultShockPct: number;
  minShockPct: number;
  maxShockPct: number;
  status: 'draft' | 'approved';
  reviewedBy: string;
}

export interface InflationView {
  period: string;
  headlinePct: number;
  groupsPct: CategoryShares;
  personal: PersonalInflation;
  realSalary?: { gross: number; since?: string; nowWorth: number };
  bufferTarget?: number;
  monthly: SpendingProfile['monthly'];
  /** What 10,000 lei does in a year against YOUR inflation, by kind of place (no provider names). */
  savings: { amountLei: number; rows: { label: string; netRatePct: number; realChangeLei: number }[]; exampleRates: boolean };
  source: { label: string; url: string };
}

export interface MomentView {
  payslip?: PayslipBreakdown & { pillar2Deadline?: string };
  inflation?: InflationView;
  scenario?: Scenario & { monthlySpend: number };
  /** The correct answer for a predict step, keyed by the step's `answer` field. */
  answers: Record<string, number>;
  /** Values for {{placeholders}} in questions and cards. */
  vars: Record<string, string | number | undefined>;
}

export type OfferKind = 'deposit' | 'state_bond';
export type Horizon = 'any_time' | 'one_to_two_years' | 'later';

export interface Offer {
  id: string;
  provider: string;
  product: string;
  kind: OfferKind;
  grossRatePct: number;
  /** 0 = instant access. */
  termMonths: number;
  /** 1 = take it out any time, 2 = lose interest if you break it, 3 = locked until maturity (or sold at market price). */
  accessRank: 1 | 2 | 3;
  minAmountLei: number;
  conditions: string[];
  partnerId: string | null;
  example?: boolean;
  updatedAt: string;
}

export interface RankedOffer extends Offer {
  rank: number;
  netRatePct: number;
  gainLei: number;
  isPartner: boolean;
}

export interface Metrics {
  moments: Record<string, { opened: number; completed: number }>;
  actions: { set: number; confirmed: number; skipped: number };
  /** Confirmed actions / completed moments. The north-star input. */
  actionRate: number;
  payslipGuess?: { count: number; avgGuess: number; avgActual: number; underGuessedShare: number };
  referrals: { clicked: number; opened: number; funded: number; feesLei: number };
}

export interface ApiError {
  error: string;
  hint?: string;
}

/** What a client may see of a partner (no secret names). */
export interface PublicPartner {
  id: string;
  kind: 'bank' | 'broker' | 'employer';
  displayName: string;
  theme: { primary: string; ground: string; ink: string } | null;
  feePerFundedLei: number;
  feeIsExample?: boolean;
}

// ---- Users and session (cookie `rost_uid`) ----

/** POST /api/users. Either `{ demo: "maria" }` (demo personas only) or an onboarding profile. */
export interface CreateUserRequest {
  demo?: string;
  name?: string;
  situations?: Situation[];
  payday?: number;
  hireDate?: string;
  grossMonthly?: number;
  monthlyExpenses?: number;
  firstsDone?: FirstDone[];
  spending?: SpendingProfile;
}
export interface CreateUserResponse {
  userId: string;
}

/** GET /api/me. 401 without a session, profile only after the quiz. */
export interface MeResponse {
  user: User;
  profile?: Profile;
}

// ---- Triggers ----

/** POST /api/events */
export interface EventRequest {
  type: EventType;
  payload?: Record<string, unknown>;
  ignoreWeeklyCap?: boolean;
}
export interface EventResponse {
  event: AppEvent;
  decision: Decision;
  runs: MomentRun[];
}

/** POST /api/calendar */
export interface CalendarResponse {
  today: string;
  results: EventResponse[];
}

/** GET/POST /api/clock (demo tools only). POST body: `{ days: number }`. */
export interface ClockResponse {
  offsetDays: number;
  now: string;
}

// ---- Screens ----

/** GET /api/today: everything the Today screen shows. */
export interface TodayResponse {
  user: User;
  /** Moments waiting for the user (pending or started). */
  open: MomentRun[];
  /** All moment definitions, in library order. */
  moments: MomentDefinition[];
  doneMomentIds: string[];
  /** Moments the user can open now with a "catch up" tap. */
  catchUpMomentIds: string[];
  /** Actions whose 7-day check is due. */
  dueFollowUps: Action[];
}

/** GET /api/moments/:runId. Step text comes with {{placeholders}} already filled. */
export interface MomentResponse {
  run: MomentRun;
  def: MomentDefinition;
  view: MomentView;
}

/** POST /api/moments/:runId */
export type MomentPostRequest =
  | { kind: 'guess'; value: number; answerKey: string }
  | { kind: 'action'; actionType: string; params: Record<string, unknown> }
  | { kind: 'dismiss' };
export type MomentPostResponse = { run: MomentRun; answer?: number } | { action: Action };

/** GET /api/followups */
export interface FollowUpsResponse {
  due: Action[];
}
/** POST /api/followups */
export interface FollowUpRequest {
  actionId: string;
  status: 'confirmed' | 'skipped';
}

/** GET /api/options?horizon=&amount= : the neutral ranking. */
export interface OptionsResponse {
  horizon: Horizon;
  amountLei: number;
  /** The user's personal inflation when we know their spending, else the national figure. */
  inflationPct: number;
  personalInflation: boolean;
  offers: (RankedOffer & { realChangeLei: number })[];
}

/** GET /api/metrics: aggregates only. */
export interface MetricsResponse extends Metrics {
  mode: 'db';
  momentTitles: Record<string, string>;
}

// ---- Referrals ----

/** POST /api/referrals/clicks: records a click from an options or asset page. */
export interface ReferralClickRequest {
  offerId: string;
}
export interface ReferralClickResponse {
  clickId: string;
  offerId: string;
}

/** GET /api/referrals/:clickId: what the mock provider page shows. */
export interface ReferralResponse {
  referral: Referral;
  offer: Offer;
  partner?: PublicPartner;
}

/** POST /api/referrals/postback (partner servers; header x-postback-secret when configured). */
export interface PostbackRequest {
  clickId: string;
  status: 'opened' | 'funded';
}
export interface PostbackResponse {
  referral: Referral;
}

// ---- Partner view ----

/** GET /api/partner/demo-token (demo tools only). `url` is a frontend path. */
export interface DemoTokenResponse {
  token: string;
  url: string;
}

/** GET /api/embed?token= : the partner view's data. 401 when the token is bad or expired. */
export interface EmbedResponse {
  partner: PublicPartner;
  inflation: InflationView;
  scenario?: Scenario & { monthlySpend: number };
}

// ---- Payslip reader ----

/** POST /api/payslip/read (multipart, field `image`). 501 when not configured. */
export interface PayslipReadResponse {
  grossLei: number | null;
  confidence: number;
}

// ---- Quiz, library, Momente, Știri ----

/** GET /api/quiz, without the answers */
export interface QuizResponse {
  knowledge: { id: string; question: string; options: string[] }[];
}

/** POST /api/quiz, creates the user if there is no session */
export type QuizRequest = QuizAnswers;
export interface QuizSaveResponse {
  userId: string;
  profile: Profile;
  results: { id: string; correct: boolean; correctIndex: number; explain?: string }[];
}

/** GET /api/library, GET /api/library/{id} */
export interface LibraryResponse {
  moments: LibraryMoment[];
}
export interface LibraryMomentResponse {
  moment: LibraryMoment;
}

/** POST /api/library/{id}/complete, body optional. 409 = not written yet */
export interface CompleteLibraryRequest {
  /** picked for choice, value for predict, buckets (one per item) for sort */
  answers?: { step: number; picked?: number; value?: number; buckets?: (0 | 1)[] }[];
}
export interface CompleteLibraryResponse {
  /** null before the quiz */
  profile: Profile | null;
  levelUp: boolean;
  alreadyDone: boolean;
  correct: number;
  total: number;
}

/** GET /api/momente, GET /api/stiri. 404 before the quiz */
export type { MomenteResponse, StiriResponse };

// ---- Tracking ----

export type TrackEventName =
  | 'page_view'
  | 'quiz_start'
  | 'quiz_step'
  | 'asset_view'
  | 'provider_click'
  | 'moment_open'
  | 'moment_step'
  | 'moment_close'
  | 'news_view'
  | 'news_slider'
  | 'cta_click';

/** POST /api/track, max 50 events, flat props */
export interface TrackRequest {
  events: { name: TrackEventName; props?: Record<string, string | number | boolean>; path?: string }[];
}

// ---- Admin (cookie `rost_admin`, path /api/admin) ----

export interface Admin {
  id: string;
  email: string;
  createdAt: string;
}

/** POST /api/admin/login. 429 after 5 wrong tries */
export interface AdminLoginRequest {
  email: string;
  password: string;
}

export type ContentKind = 'moments' | 'news';
export type ContentStatus = 'draft' | 'published';

export interface ContentItem<D = LibraryMoment | NewsItem> {
  kind: ContentKind;
  id: string;
  status: ContentStatus;
  position: number;
  doc: D;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

/** POST / PUT /api/admin/content/{kind}. doc.id can't change */
export interface ContentRequest<D = LibraryMoment | NewsItem> {
  status: ContentStatus;
  position?: number;
  doc: D;
}

/** GET /api/admin/stats?days=30 */
export interface StatsResponse {
  from: string;
  to: string;
  users: { total: number; new: number; active: number; withQuiz: number };
  daily: { date: string; newUsers: number; activeUsers: number; events: number }[];
  levels: Record<'0' | '1' | '2', number>;
  riskProfile: Partial<Record<RiskProfile, number>>;
  quiz: { started: number; completed: number; avgScore: number | null };
  levelUps: number;
  library: {
    momentId: string;
    title: string;
    level: Level;
    opened: number;
    completed: number;
    completionRate: number | null;
    correctRate: number | null;
  }[];
  assets: { assetId: string; views: number; providerClicks: number }[];
  news: { key: string; count: number }[];
  pages: { key: string; count: number }[];
  events: Record<string, number>;
  triggered: Metrics;
}
