import { describe, expect, it } from 'vitest';
import type { TodayResponse } from '@/contract';
import { PERSONAS } from '../fixtures/personas';
import { SEED_LESSONS } from '../fixtures/seed-lessons';
import type { Profile } from '../types';
import { buildMomente, buildRoadmap, resumable } from './momente';

const today = {
  open: [{ id: 'run1', momentId: 'payslip_explained', state: 'pending' }],
  moments: [{ id: 'payslip_explained', title: 'Your payslip, explained', series: 'Prima dată', minutes: 3 }],
} as unknown as TodayResponse;

describe('Momente order', () => {
  it('puts triggered real runs first, linked to the real player', () => {
    expect(buildMomente(PERSONAS.maria, today, SEED_LESSONS).triggered[0]).toMatchObject({ status: 'open', href: '/moment/run1' });
  });

  it("lists the user's own level first, then lower levels not yet done", () => {
    expect(buildMomente(PERSONAS.maria, today, SEED_LESSONS).forYourLevel.map((x) => x.id)).toEqual([
      'titluri_stat',
      'etf',
      'fondul_urgenta',
      'economii_vs_depozit',
      'dobanda_compusa',
    ]);
  });

  it('puts lessons you can play above the ones still being written', () => {
    const l2: Profile = { ...PERSONAS.maria, quizLevel: 2, level: 2 };
    const statuses = buildMomente(l2, today, SEED_LESSONS).forYourLevel.map((x) => x.status);
    expect(statuses.indexOf('soon')).toBeGreaterThan(statuses.lastIndexOf('todo'));
  });

  it('keeps an L0 user to L0 moments for their level', () => {
    const l0: Profile = { ...PERSONAS.maria, quizLevel: 0, level: 0 };
    expect(buildMomente(l0, today, SEED_LESSONS).forYourLevel.every((x) => x.level === 0)).toBe(true);
  });

  it('counts core moments done towards the next level', () => {
    const l0: Profile = { ...PERSONAS.maria, quizLevel: 0, level: 0, completedMomentIds: ['fondul_urgenta'] };
    expect(buildMomente(l0, today, SEED_LESSONS).progress).toEqual({ level: 0, coreDone: 1, coreTotal: 3, nextLevel: 1 });
  });

  it('still lists the lessons when only /api/today is down', () => {
    const down = buildMomente(PERSONAS.maria, undefined, SEED_LESSONS);
    expect(down.realApiDown).toBe(true);
    expect(down.triggered).toEqual([]);
    expect(down.forYourLevel.length).toBeGreaterThan(0);
  });

  it('shows no lessons, not stale ones, when the lessons API is down', () => {
    expect(buildMomente(PERSONAS.maria, today, []).forYourLevel).toEqual([]);
  });

  it('shows a lesson left halfway as in progress, first, and resumes on the next visit', () => {
    const etf = SEED_LESSONS.find((m) => m.id === 'etf')!;
    const p: Profile = { ...PERSONAS.maria, lessonProgress: { etf: { step: 2, results: [true], of: etf.steps.length } } };
    const m = buildMomente(p, today, SEED_LESSONS);
    expect(m.forYourLevel[0]).toMatchObject({ id: 'etf', status: 'started', progress: { step: 3, of: etf.steps.length }, href: '/moment/lib/etf' });
    expect(resumable(etf, p)).toEqual({ step: 2, results: [true], of: etf.steps.length });
  });

  it('starts over when the lesson changed since, or was left on the first or last screen', () => {
    const etf = SEED_LESSONS.find((m) => m.id === 'etf')!;
    const at = (step: number, of = etf.steps.length): Profile => ({ ...PERSONAS.maria, lessonProgress: { etf: { step, results: [], of } } });
    expect(resumable(etf, at(2, etf.steps.length + 1))).toBeUndefined();
    expect(resumable(etf, at(0))).toBeUndefined();
    expect(resumable(etf, at(etf.steps.length - 1))).toBeUndefined();
  });

  it('keeps finished lessons open to replay', () => {
    const p: Profile = { ...PERSONAS.maria, completedMomentIds: ['fondul_urgenta'] };
    expect(buildMomente(p, today, SEED_LESSONS).rest.find((m) => m.id === 'fondul_urgenta')).toMatchObject({ status: 'done', href: '/moment/lib/fondul_urgenta' });
  });
});

describe('your salary', () => {
  it('links a payslip moment already done to the salary page, where it can be changed', () => {
    const done = { ...today, open: [], doneMomentIds: ['payslip_explained'], catchUpMomentIds: [] } as unknown as TodayResponse;
    const row = buildMomente(PERSONAS.maria, done, SEED_LESSONS).rest.find((m) => m.id === 'payslip_explained');
    expect(row).toMatchObject({ status: 'done', href: '/salariu' });
  });
});

describe('roadmap', () => {
  const l0: Profile = { ...PERSONAS.maria, quizLevel: 0, level: 0, bufferMonths: 0, completedMomentIds: [] };

  it('walks the levels in order, with one current lesson', () => {
    const roadmap = buildRoadmap(l0, SEED_LESSONS);
    expect(roadmap.map((l) => l.level)).toEqual([0, 1, 2]);
    const nodes = roadmap.flatMap((l) => l.nodes);
    expect(nodes.filter((n) => n.state === 'current').map((n) => n.id)).toEqual(['fondul_urgenta']);
  });

  it('marks done lessons, and lessons above your level as locked', () => {
    const roadmap = buildRoadmap({ ...l0, completedMomentIds: ['fondul_urgenta'] }, SEED_LESSONS);
    const state = Object.fromEntries(roadmap.flatMap((l) => l.nodes).map((n) => [n.id, n.state]));
    expect(state).toMatchObject({ fondul_urgenta: 'done', economii_vs_depozit: 'current', dobanda_compusa: 'open', etf: 'locked', actiuni: 'soon' });
    expect(roadmap[0]).toMatchObject({ coreDone: 1, coreTotal: 3, reached: true });
    expect(roadmap[1].reached).toBe(false);
  });

  it('makes a lesson left halfway the current one', () => {
    const halfway = { ...l0, lessonProgress: { dobanda_compusa: { step: 2, results: [true], of: SEED_LESSONS.find((m) => m.id === 'dobanda_compusa')!.steps.length } } };
    const current = buildRoadmap(halfway, SEED_LESSONS).flatMap((l) => l.nodes).find((n) => n.state === 'current');
    expect(current).toMatchObject({ id: 'dobanda_compusa', progress: { step: 3 } });
  });
});
