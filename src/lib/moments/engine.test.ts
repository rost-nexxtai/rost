import { describe, expect, it } from 'vitest';
import { momentDefs } from '../reference';
import type { MomentRun, User } from '../store/types';
import { decide, fill } from './engine';

const maria: User = {
  id: 'maria',
  situations: ['graduate', 'employed'],
  grossMonthly: 6000,
  hireDate: '2026-09-01',
  monthlyExpenses: 2500,
  firstsDone: [],
  spending: { shares: { services: 0.55, nonFood: 0.25, food: 0.2 }, monthly: { fuel: 400 }, source: 'self' },
  createdAt: '2026-10-01T00:00:00.000Z',
};
const now = '2026-10-28T12:00:00.000Z';
const ev = (type: string, source = 'simulator', payload: Record<string, unknown> = {}) =>
  ({ type, source, payload }) as never;
const run = (momentId: string, state: MomentRun['state'], createdAt: string): MomentRun => ({
  id: momentId + state,
  userId: 'maria',
  momentId,
  state,
  createdAt,
});

describe('moment engine', () => {
  it('opens the payslip moment on salary_received', () => {
    expect(decide(momentDefs(), maria, ev('salary_received'), [], now).open).toEqual(['payslip_explained']);
  });

  it('opens personal inflation on inflation_published', () => {
    expect(decide(momentDefs(), maria, ev('inflation_published'), [], now).open).toEqual(['personal_inflation']);
  });

  it('stays silent for a student (situation not met)', () => {
    const student = { ...maria, situations: ['student'] as User['situations'] };
    const d = decide(momentDefs(), student, ev('salary_received'), [], now);
    expect(d.open).toEqual([]);
    expect(d.skipped[0].reason).toBe('situation');
  });

  it('respects the one-moment-a-week cap, unless the user asked', () => {
    const recent = [run('payslip_explained', 'completed', '2026-10-25T00:00:00.000Z')];
    expect(decide(momentDefs(), maria, ev('inflation_published'), recent, now).skipped[0].reason).toBe('weekly_cap');
    expect(decide(momentDefs(), maria, ev('inflation_published'), recent, now, { ignoreWeeklyCap: true }).open).toEqual([
      'personal_inflation',
    ]);
    expect(decide(momentDefs(), maria, ev('catch_up', 'user', { momentId: 'personal_inflation' }), recent, now).open).toEqual([
      'personal_inflation',
    ]);
  });

  it('does not repeat a completed first, but repeats news moments', () => {
    const old = '2026-09-01T00:00:00.000Z';
    expect(
      decide(momentDefs(), maria, ev('salary_received'), [run('payslip_explained', 'completed', old)], now).skipped[0].reason,
    ).toBe('already_done');
    expect(
      decide(momentDefs(), maria, ev('raise'), [run('payslip_explained', 'completed', old)], now).open,
    ).toEqual(['payslip_explained']);
    expect(
      decide(momentDefs(), maria, ev('inflation_published'), [run('personal_inflation', 'completed', old)], now).open,
    ).toEqual(['personal_inflation']);
  });

  it('fills placeholders', () => {
    expect(fill('Out of {{gross}} lei, {{ missing }}ok', { gross: '6,000' })).toBe('Out of 6,000 lei, ok');
  });
});
