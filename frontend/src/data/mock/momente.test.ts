import { describe, expect, it } from 'vitest';
import type { TodayResponse } from '@/contract';
import { PERSONAS } from '../fixtures/personas';
import type { Profile } from '../types';
import { buildMomente } from './momente';

const today = {
  open: [{ id: 'run1', momentId: 'payslip_explained', state: 'pending' }],
  moments: [{ id: 'payslip_explained', title: 'Your payslip, explained', series: 'Prima dată', minutes: 3 }],
} as unknown as TodayResponse;

describe('Momente order', () => {
  it('puts triggered real runs first, linked to the real player', () => {
    expect(buildMomente(PERSONAS.maria, today).triggered[0]).toMatchObject({ status: 'open', href: '/moment/run1' });
  });

  it("lists the user's own level first, then lower levels not yet done", () => {
    expect(buildMomente(PERSONAS.maria, today).forYourLevel.map((x) => x.id)).toEqual([
      'titluri_stat',
      'etf',
      'fondul_urgenta',
      'economii_vs_depozit',
      'dobanda_compusa',
    ]);
  });

  it('puts lessons you can play above the ones still being written', () => {
    const l2: Profile = { ...PERSONAS.maria, quizLevel: 2, level: 2 };
    const statuses = buildMomente(l2, today).forYourLevel.map((x) => x.status);
    expect(statuses.indexOf('soon')).toBeGreaterThan(statuses.lastIndexOf('todo'));
  });

  it('keeps an L0 user to L0 moments for their level', () => {
    const l0: Profile = { ...PERSONAS.maria, quizLevel: 0, level: 0 };
    expect(buildMomente(l0, today).forYourLevel.every((x) => x.level === 0)).toBe(true);
  });

  it('counts core moments done towards the next level', () => {
    const l0: Profile = { ...PERSONAS.maria, quizLevel: 0, level: 0, completedMomentIds: ['fondul_urgenta'] };
    expect(buildMomente(l0, today).progress).toEqual({ level: 0, coreDone: 1, coreTotal: 3, nextLevel: 1 });
  });

  it('still lists the library when the backend is down', () => {
    const down = buildMomente(PERSONAS.maria, undefined);
    expect(down.realApiDown).toBe(true);
    expect(down.triggered).toEqual([]);
    expect(down.forYourLevel.length).toBeGreaterThan(0);
  });
});
