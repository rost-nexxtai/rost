import { randomUUID } from 'node:crypto';
import { nowIso } from '../clock';
import type { Action, AppEvent, MomentRun, Referral, Store, User } from './types';

/** Anything with node-postgres's query signature: a pg Pool, a pg Client, or pg-mem's adapter. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v));
const parse = <T>(v: unknown): T | undefined =>
  v === null || v === undefined ? undefined : ((typeof v === 'string' ? JSON.parse(v) : v) as T);
const num = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const str = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));

function toUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id),
    name: str(r.name),
    situations: parse(r.situations) ?? [],
    payday: num(r.payday),
    hireDate: str(r.hire_date),
    grossMonthly: num(r.gross_monthly),
    lastRaiseDate: str(r.last_raise_date),
    monthlyExpenses: num(r.monthly_expenses),
    firstsDone: parse(r.firsts_done) ?? [],
    spending: parse(r.spending),
    createdAt: String(r.created_at),
  };
}

function toEvent(r: Record<string, unknown>): AppEvent {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    type: r.type as AppEvent['type'],
    payload: parse(r.payload) ?? {},
    source: r.source as AppEvent['source'],
    createdAt: String(r.created_at),
  };
}

function toRun(r: Record<string, unknown>): MomentRun {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    momentId: String(r.moment_id),
    triggerEventId: str(r.trigger_event_id),
    state: r.state as MomentRun['state'],
    guess: num(r.guess),
    result: parse(r.result),
    createdAt: String(r.created_at),
    startedAt: str(r.started_at),
    completedAt: str(r.completed_at),
  };
}

function toAction(r: Record<string, unknown>): Action {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    momentRunId: String(r.moment_run_id),
    type: String(r.type),
    params: parse(r.params) ?? {},
    status: r.status as Action['status'],
    followUpAt: String(r.follow_up_at),
    createdAt: String(r.created_at),
  };
}

function toReferral(r: Record<string, unknown>): Referral {
  return {
    id: String(r.id),
    clickId: String(r.click_id),
    userId: str(r.user_id),
    offerId: String(r.offer_id),
    partnerId: str(r.partner_id),
    status: r.status as Referral['status'],
    feeLei: num(r.fee_lei) ?? 0,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

/** Working mode: Postgres (local Docker or Supabase). Schema in db/migrations. */
export class PgStore implements Store {
  readonly mode = 'db' as const;
  constructor(private db: Queryable) {}

  private async one(sql: string, params: unknown[]) {
    const { rows } = await this.db.query(sql, params);
    return rows[0];
  }

  async createUser(u: Omit<User, 'createdAt'> & { createdAt?: string }): Promise<User> {
    const user: User = { ...u, createdAt: u.createdAt ?? nowIso() };
    await this.db.query(
      `INSERT INTO users (id, name, situations, payday, hire_date, gross_monthly, last_raise_date, monthly_expenses, firsts_done, spending, created_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)`,
      [
        user.id, user.name ?? null, json(user.situations), user.payday ?? null, user.hireDate ?? null,
        user.grossMonthly ?? null, user.lastRaiseDate ?? null, user.monthlyExpenses ?? null,
        json(user.firstsDone), json(user.spending), user.createdAt,
      ],
    );
    return user;
  }

  async getUser(id: string) {
    const r = await this.one('SELECT * FROM users WHERE id = $1', [id]);
    return r ? toUser(r) : undefined;
  }

  async updateUser(id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>) {
    const cur = await this.getUser(id);
    if (!cur) throw new Error(`user ${id} not found`);
    const u = { ...cur, ...patch };
    await this.db.query(
      `UPDATE users SET name = $2, situations = $3::jsonb, payday = $4, hire_date = $5, gross_monthly = $6,
       last_raise_date = $7, monthly_expenses = $8, firsts_done = $9::jsonb, spending = $10::jsonb WHERE id = $1`,
      [
        id, u.name ?? null, json(u.situations), u.payday ?? null, u.hireDate ?? null, u.grossMonthly ?? null,
        u.lastRaiseDate ?? null, u.monthlyExpenses ?? null, json(u.firstsDone), json(u.spending),
      ],
    );
    return u;
  }

  async addEvent(e: Omit<AppEvent, 'id' | 'createdAt'> & { createdAt?: string }) {
    const ev: AppEvent = { ...e, id: randomUUID(), createdAt: e.createdAt ?? nowIso() };
    await this.db.query(
      'INSERT INTO events (id, user_id, type, payload, source, created_at) VALUES ($1, $2, $3, $4::jsonb, $5, $6)',
      [ev.id, ev.userId, ev.type, json(ev.payload), ev.source, ev.createdAt],
    );
    return ev;
  }

  async listEvents(userId: string) {
    const { rows } = await this.db.query('SELECT * FROM events WHERE user_id = $1 ORDER BY created_at', [userId]);
    return rows.map(toEvent);
  }

  async createRun(r: Omit<MomentRun, 'id' | 'createdAt'> & { createdAt?: string }) {
    const run: MomentRun = { ...r, id: randomUUID(), createdAt: r.createdAt ?? nowIso() };
    await this.db.query(
      `INSERT INTO moment_runs (id, user_id, moment_id, trigger_event_id, state, guess, result, created_at, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
      [
        run.id, run.userId, run.momentId, run.triggerEventId ?? null, run.state, run.guess ?? null,
        json(run.result), run.createdAt, run.startedAt ?? null, run.completedAt ?? null,
      ],
    );
    return run;
  }

  async getRun(id: string) {
    const r = await this.one('SELECT * FROM moment_runs WHERE id = $1', [id]);
    return r ? toRun(r) : undefined;
  }

  async updateRun(id: string, patch: Partial<Omit<MomentRun, 'id' | 'userId' | 'createdAt'>>) {
    const cur = await this.getRun(id);
    if (!cur) throw new Error(`run ${id} not found`);
    const r = { ...cur, ...patch };
    await this.db.query(
      `UPDATE moment_runs SET moment_id = $2, trigger_event_id = $3, state = $4, guess = $5, result = $6::jsonb,
       started_at = $7, completed_at = $8 WHERE id = $1`,
      [id, r.momentId, r.triggerEventId ?? null, r.state, r.guess ?? null, json(r.result), r.startedAt ?? null, r.completedAt ?? null],
    );
    return r;
  }

  async listRuns(userId?: string) {
    const { rows } = userId
      ? await this.db.query('SELECT * FROM moment_runs WHERE user_id = $1 ORDER BY created_at', [userId])
      : await this.db.query('SELECT * FROM moment_runs ORDER BY created_at');
    return rows.map(toRun);
  }

  async createAction(a: Omit<Action, 'id' | 'createdAt'> & { createdAt?: string }) {
    const action: Action = { ...a, id: randomUUID(), createdAt: a.createdAt ?? nowIso() };
    await this.db.query(
      `INSERT INTO actions (id, user_id, moment_run_id, type, params, status, follow_up_at, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [action.id, action.userId, action.momentRunId, action.type, json(action.params), action.status, action.followUpAt, action.createdAt],
    );
    return action;
  }

  async updateAction(id: string, patch: Partial<Pick<Action, 'status' | 'params'>>) {
    const cur = await this.one('SELECT * FROM actions WHERE id = $1', [id]);
    if (!cur) throw new Error(`action ${id} not found`);
    const a = { ...toAction(cur), ...patch };
    await this.db.query('UPDATE actions SET status = $2, params = $3::jsonb WHERE id = $1', [id, a.status, json(a.params)]);
    return a;
  }

  async listActions(userId?: string) {
    const { rows } = userId
      ? await this.db.query('SELECT * FROM actions WHERE user_id = $1 ORDER BY created_at', [userId])
      : await this.db.query('SELECT * FROM actions ORDER BY created_at');
    return rows.map(toAction);
  }

  async createReferral(r: Omit<Referral, 'id' | 'createdAt' | 'updatedAt'>) {
    const t = nowIso();
    const ref: Referral = { ...r, id: randomUUID(), createdAt: t, updatedAt: t };
    await this.db.query(
      `INSERT INTO referrals (id, click_id, user_id, offer_id, partner_id, status, fee_lei, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [ref.id, ref.clickId, ref.userId ?? null, ref.offerId, ref.partnerId ?? null, ref.status, ref.feeLei, t, t],
    );
    return ref;
  }

  async getReferralByClick(clickId: string) {
    const r = await this.one('SELECT * FROM referrals WHERE click_id = $1', [clickId]);
    return r ? toReferral(r) : undefined;
  }

  async updateReferral(clickId: string, patch: Partial<Pick<Referral, 'status' | 'feeLei'>>) {
    const cur = await this.getReferralByClick(clickId);
    if (!cur) throw new Error(`referral ${clickId} not found`);
    const r = { ...cur, ...patch, updatedAt: nowIso() };
    await this.db.query('UPDATE referrals SET status = $2, fee_lei = $3, updated_at = $4 WHERE click_id = $1', [
      clickId, r.status, r.feeLei, r.updatedAt,
    ]);
    return r;
  }

  async listReferrals() {
    const { rows } = await this.db.query('SELECT * FROM referrals ORDER BY created_at');
    return rows.map(toReferral);
  }
}
