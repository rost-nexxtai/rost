import { randomUUID } from 'node:crypto';
import demoUsers from '../../../data/seed/demo-users.json';
import { nowIso } from '../clock';
import type { Action, AppEvent, MomentRun, Referral, Store, User } from './types';

/**
 * Demo mode: everything in memory, seeded with the demo persona.
 * Works offline on stage; resets when the server restarts.
 */
export class JsonStore implements Store {
  readonly mode = 'demo' as const;
  private users = new Map<string, User>();
  private events: AppEvent[] = [];
  private runs = new Map<string, MomentRun>();
  private actions = new Map<string, Action>();
  private referrals = new Map<string, Referral>();

  static seeded(): JsonStore {
    const s = new JsonStore();
    for (const u of demoUsers.users) {
      s.users.set(u.id, { ...(u as Omit<User, 'createdAt'>), createdAt: nowIso() });
    }
    return s;
  }

  async createUser(u: Omit<User, 'createdAt'> & { createdAt?: string }): Promise<User> {
    const user: User = { ...u, createdAt: u.createdAt ?? nowIso() };
    this.users.set(user.id, user);
    return structuredClone(user);
  }

  async getUser(id: string) {
    const u = this.users.get(id);
    return u ? structuredClone(u) : undefined;
  }

  async updateUser(id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>) {
    const u = this.users.get(id);
    if (!u) throw new Error(`user ${id} not found`);
    const next = { ...u, ...patch };
    this.users.set(id, next);
    return structuredClone(next);
  }

  async addEvent(e: Omit<AppEvent, 'id' | 'createdAt'> & { createdAt?: string }) {
    const ev: AppEvent = { ...e, id: randomUUID(), createdAt: e.createdAt ?? nowIso() };
    this.events.push(ev);
    return structuredClone(ev);
  }

  async listEvents(userId: string) {
    return this.events.filter((e) => e.userId === userId).map((e) => structuredClone(e));
  }

  async createRun(r: Omit<MomentRun, 'id' | 'createdAt'> & { createdAt?: string }) {
    const run: MomentRun = { ...r, id: randomUUID(), createdAt: r.createdAt ?? nowIso() };
    this.runs.set(run.id, run);
    return structuredClone(run);
  }

  async getRun(id: string) {
    const r = this.runs.get(id);
    return r ? structuredClone(r) : undefined;
  }

  async updateRun(id: string, patch: Partial<Omit<MomentRun, 'id' | 'userId' | 'createdAt'>>) {
    const r = this.runs.get(id);
    if (!r) throw new Error(`run ${id} not found`);
    const next = { ...r, ...patch };
    this.runs.set(id, next);
    return structuredClone(next);
  }

  async listRuns(userId?: string) {
    return [...this.runs.values()]
      .filter((r) => !userId || r.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((r) => structuredClone(r));
  }

  async createAction(a: Omit<Action, 'id' | 'createdAt'> & { createdAt?: string }) {
    const action: Action = { ...a, id: randomUUID(), createdAt: a.createdAt ?? nowIso() };
    this.actions.set(action.id, action);
    return structuredClone(action);
  }

  async updateAction(id: string, patch: Partial<Pick<Action, 'status' | 'params'>>) {
    const a = this.actions.get(id);
    if (!a) throw new Error(`action ${id} not found`);
    const next = { ...a, ...patch };
    this.actions.set(id, next);
    return structuredClone(next);
  }

  async listActions(userId?: string) {
    return [...this.actions.values()]
      .filter((a) => !userId || a.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((a) => structuredClone(a));
  }

  async createReferral(r: Omit<Referral, 'id' | 'createdAt' | 'updatedAt'>) {
    const t = nowIso();
    const ref: Referral = { ...r, id: randomUUID(), createdAt: t, updatedAt: t };
    this.referrals.set(ref.clickId, ref);
    return structuredClone(ref);
  }

  async getReferralByClick(clickId: string) {
    const r = this.referrals.get(clickId);
    return r ? structuredClone(r) : undefined;
  }

  async updateReferral(clickId: string, patch: Partial<Pick<Referral, 'status' | 'feeLei'>>) {
    const r = this.referrals.get(clickId);
    if (!r) throw new Error(`referral ${clickId} not found`);
    const next = { ...r, ...patch, updatedAt: nowIso() };
    this.referrals.set(clickId, next);
    return structuredClone(next);
  }

  async listReferrals() {
    return [...this.referrals.values()].map((r) => structuredClone(r));
  }
}
