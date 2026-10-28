import type { CategoryShares } from '../rules/inflation';

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

export interface SpendingProfile {
  /** Shares of monthly spending in INS's three groups. */
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
  createdAt: string;
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

/**
 * Everything that changes at runtime. Reference data (offers, partners, inflation figures,
 * moment definitions, scenarios) lives in versioned JSON under /data and is reviewed like code.
 */
export interface Store {
  readonly mode: 'demo' | 'db';

  createUser(u: Omit<User, 'createdAt'> & { createdAt?: string }): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  updateUser(id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>;

  addEvent(e: Omit<AppEvent, 'id' | 'createdAt'> & { createdAt?: string }): Promise<AppEvent>;
  listEvents(userId: string): Promise<AppEvent[]>;

  createRun(r: Omit<MomentRun, 'id' | 'createdAt'> & { createdAt?: string }): Promise<MomentRun>;
  getRun(id: string): Promise<MomentRun | undefined>;
  updateRun(id: string, patch: Partial<Omit<MomentRun, 'id' | 'userId' | 'createdAt'>>): Promise<MomentRun>;
  listRuns(userId?: string): Promise<MomentRun[]>;

  createAction(a: Omit<Action, 'id' | 'createdAt'> & { createdAt?: string }): Promise<Action>;
  updateAction(id: string, patch: Partial<Pick<Action, 'status' | 'params'>>): Promise<Action>;
  listActions(userId?: string): Promise<Action[]>;

  createReferral(r: Omit<Referral, 'id' | 'createdAt' | 'updatedAt'>): Promise<Referral>;
  getReferralByClick(clickId: string): Promise<Referral | undefined>;
  updateReferral(clickId: string, patch: Partial<Pick<Referral, 'status' | 'feeLei'>>): Promise<Referral>;
  listReferrals(): Promise<Referral[]>;
}
