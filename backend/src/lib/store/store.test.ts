import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';
import { JsonStore } from './json-store';
import { PgStore, type Queryable } from './pg-store';
import type { Store } from './types';

function pgMemStore(): Store {
  const db = newDb();
  const sql = readFileSync(fileURLToPath(new URL('../../../db/migrations/001_init.sql', import.meta.url)), 'utf8');
  db.public.none(sql);
  const { Pool } = db.adapters.createPg();
  return new PgStore(new Pool() as unknown as Queryable);
}

// The same contract runs against both stores, so demo mode and working mode behave alike.
describe.each([
  ['JsonStore (demo)', () => new JsonStore() as Store],
  ['PgStore (working, pg-mem)', pgMemStore],
])('%s', (_name, make) => {
  it('stores users, runs, actions and referrals', async () => {
    const s = make();
    await s.createUser({
      id: 'u1',
      situations: ['employed'],
      firstsDone: [],
      grossMonthly: 6000,
      spending: { shares: { services: 0.55, nonFood: 0.25, food: 0.2 }, monthly: { fuel: 400 }, source: 'self' },
    });
    const u = await s.updateUser('u1', { firstsDone: ['payslip'], hireDate: '2026-09-01' });
    expect(u.firstsDone).toEqual(['payslip']);
    const got = await s.getUser('u1');
    expect(got?.grossMonthly).toBe(6000);
    expect(got?.spending?.shares.services).toBe(0.55);
    expect(got?.hireDate).toBe('2026-09-01');

    const ev = await s.addEvent({ userId: 'u1', type: 'salary_received', payload: { amount: 3510 }, source: 'simulator' });
    expect((await s.listEvents('u1'))[0].payload).toEqual({ amount: 3510 });

    const run = await s.createRun({ userId: 'u1', momentId: 'payslip_explained', triggerEventId: ev.id, state: 'pending' });
    await s.updateRun(run.id, { state: 'completed', guess: 300, result: { pension: 1500 } });
    const r2 = await s.getRun(run.id);
    expect(r2?.state).toBe('completed');
    expect(r2?.guess).toBe(300);
    expect(r2?.result).toEqual({ pension: 1500 });
    expect(await s.listRuns('u1')).toHaveLength(1);

    const a = await s.createAction({
      userId: 'u1', momentRunId: run.id, type: 'payday_savings_rule', params: { amount: 400 }, status: 'set',
      followUpAt: '2026-11-04T00:00:00.000Z',
    });
    await s.updateAction(a.id, { status: 'confirmed' });
    expect((await s.listActions('u1'))[0].status).toBe('confirmed');

    await s.createReferral({ clickId: 'c1', userId: 'u1', offerId: 'bank-b-12m', partnerId: 'bank-b', status: 'clicked', feeLei: 0 });
    await s.updateReferral('c1', { status: 'funded', feeLei: 50 });
    const ref = await s.getReferralByClick('c1');
    expect(ref?.status).toBe('funded');
    expect(ref?.feeLei).toBe(50);
    expect(await s.listReferrals()).toHaveLength(1);
  });
});
