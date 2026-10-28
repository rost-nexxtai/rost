import { afterEach, describe, expect, it } from 'vitest';
import { calendarEvents } from './calendar';
import { setOffsetDays } from './clock';
import { computeMetrics } from './metrics';
import { buildView } from './moments/views';
import { signPartnerToken, verifyPartnerToken } from './partner-token';
import {
  completeWithAction,
  dueFollowUps,
  getRunWithView,
  handleEvent,
  recordGuess,
  referralPostback,
  trackReferralClick,
} from './service';
import { JsonStore } from './store/json-store';

afterEach(() => setOffsetDays(0));

describe('demo path, end to end (demo store)', () => {
  it('salary -> payslip moment -> guess -> action -> follow-up -> metrics', async () => {
    const store = JsonStore.seeded();
    const { runs } = await handleEvent(store, { userId: 'maria', type: 'salary_received', source: 'simulator' });
    expect(runs.map((r) => r.momentId)).toEqual(['payslip_explained']);

    const loaded = await getRunWithView(store, runs[0].id, 'maria');
    expect(loaded?.view.payslip?.pension).toBe(1500);
    expect(loaded?.view.payslip?.pillar2).toBe(285);
    expect(loaded?.view.payslip?.pillar2Deadline).toBe('2026-12-31');

    await recordGuess(store, runs[0].id, 'maria', 300, loaded!.view.answers.pension);
    await completeWithAction(store, {
      runId: runs[0].id, userId: 'maria', actionType: 'payday_savings_rule', params: { amount: 400 }, followUpDays: 7,
    });
    expect((await store.getUser('maria'))?.firstsDone).toContain('payslip');

    expect(await dueFollowUps(store, 'maria')).toHaveLength(0);
    setOffsetDays(7);
    const due = await dueFollowUps(store, 'maria');
    expect(due).toHaveLength(1);
    await store.updateAction(due[0].id, { status: 'confirmed' });

    const m = await computeMetrics(store);
    expect(m.moments.payslip_explained).toEqual({ opened: 1, completed: 1 });
    expect(m.actionRate).toBe(1);
    expect(m.payslipGuess).toMatchObject({ count: 1, avgGuess: 300, avgActual: 1500, underGuessedShare: 1 });
  });

  it('referral: click -> funded -> fee only for partners', async () => {
    const store = new JsonStore();
    const partner = await trackReferralClick(store, 'bank-b-12m');
    const state = await trackReferralClick(store, 'fidelis-2y-lei');
    expect((await referralPostback(store, partner.clickId, 'funded')).feeLei).toBe(50);
    expect((await referralPostback(store, state.clickId, 'funded')).feeLei).toBe(0);
    expect((await computeMetrics(store)).referrals).toEqual({ clicked: 2, opened: 2, funded: 2, feesLei: 50 });
  });
});

describe('views', () => {
  it("Maria's personal inflation view (September 2026)", async () => {
    const store = JsonStore.seeded();
    const v = buildView((await store.getUser('maria'))!);
    expect(v.inflation?.headlinePct).toBe(6.61);
    expect(v.inflation?.personal.personalPct).toBe(8.48);
    expect(v.inflation?.realSalary?.nowWorth).toBe(5531);
    expect(v.inflation?.bufferTarget).toBe(8140);
    expect(v.scenario?.monthlySpend).toBe(400);
  });

  it('compares 10,000 lei of savings against her own inflation (8.48%)', async () => {
    const store = JsonStore.seeded();
    const rows = buildView((await store.getUser('maria'))!).inflation!.savings.rows;
    expect(rows.map((r) => [r.netRatePct, r.realChangeLei])).toEqual([
      [0, -782], // current account
      [3.42, -466], // best instant access: 3.8% gross, minus 10% tax on interest
      [7.6, -81], // best 1-2 years: tax-free state bond, still just under her inflation
    ]);
  });
});

describe('calendar', () => {
  it('fires the Pillar II reminder within 30 days of the deadline', async () => {
    const maria = (await JsonStore.seeded().getUser('maria'))!;
    expect(calendarEvents(maria, '2026-10-28').map((e) => e.type)).not.toContain('pillar2_deadline_near');
    expect(calendarEvents(maria, '2026-12-05').map((e) => e.type)).toContain('pillar2_deadline_near');
  });

  it('fires salary_received on payday', async () => {
    const maria = (await JsonStore.seeded().getUser('maria'))!;
    expect(calendarEvents(maria, '2026-11-10').map((e) => e.type)).toContain('salary_received');
  });
});

describe('partner token', () => {
  it('round-trips and rejects tampering', async () => {
    process.env.ALLOW_DEMO_TOKEN = 'true';
    const token = await signPartnerToken({
      partnerId: 'demo-bank', ageBand: '18-24', event: 'inflation_published',
      shares: { services: 0.55, nonFood: 0.25, food: 0.2 },
    });
    const claims = await verifyPartnerToken(token);
    expect(claims.partnerId).toBe('demo-bank');
    expect(claims.shares.services).toBe(0.55);
    const [h, p, s] = token.split('.');
    const forged = JSON.parse(Buffer.from(p, 'base64url').toString());
    forged.shares.services = 0.9;
    await expect(verifyPartnerToken([h, Buffer.from(JSON.stringify(forged)).toString('base64url'), s].join('.'))).rejects.toThrow();
  });
});
