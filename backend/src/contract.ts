/**
 * The API contract: every request and response body the backend speaks.
 * The frontend imports from this file with `import type` only, never runtime code.
 * Change a shape here first, then the route, then the screen.
 */
import type { Decision } from './lib/moments/engine';
import type { MomentDefinition } from './lib/moments/types';
import type { InflationView, MomentView } from './lib/moments/views';
import type { Metrics } from './lib/metrics';
import type { Partner, Scenario } from './lib/reference';
import type { Horizon, Offer, RankedOffer } from './lib/rules';
import type { Action, AppEvent, EventType, FirstDone, MomentRun, Referral, Situation, SpendingProfile, User } from './lib/store/types';

export type { Action, AppEvent, EventType, FirstDone, MomentRun, Referral, Situation, SpendingProfile, User };
export type { Decision, MomentDefinition, MomentView, InflationView, Metrics, Scenario, Horizon, Offer, RankedOffer };
export type { Step } from './lib/moments/types';
export type { PayslipBreakdown, PersonalInflation, CategoryShares } from './lib/rules';

export interface ApiError {
  error: string;
  hint?: string;
}

/** What a client may see of a partner (no secret names). */
export type PublicPartner = Pick<Partner, 'id' | 'kind' | 'displayName' | 'theme' | 'feePerFundedLei' | 'feeIsExample'>;

// ---- Users and session (cookie `rost_uid`) ----

/** POST /api/users. Either `{ demo: "maria" }` or an onboarding profile. */
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

/** GET /api/me. 401 when there is no session. */
export interface MeResponse {
  user: User;
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

/** GET/POST /api/clock (demo only). POST body: `{ days: number }`. */
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
  mode: 'demo' | 'db';
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

/** GET /api/partner/demo-token (stage only). `url` is a frontend path. */
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
