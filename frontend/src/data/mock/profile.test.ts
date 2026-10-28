import { describe, expect, it } from 'vitest';
import { PERSONAS } from '../fixtures/personas';
import { parseProfile } from './profile';

describe('profile cookie parsing', () => {
  it('treats a missing, corrupt or wrong-shaped cookie as no profile', () => {
    expect(parseProfile(undefined)).toBeUndefined();
    expect(parseProfile('garbage')).toBeUndefined();
    expect(parseProfile(JSON.stringify({ level: 7 }))).toBeUndefined();
  });

  it('rejects a cookie whose answered-lines list is not a list of known lines', () => {
    const bad = { ...PERSONAS.maria, money: { ...PERSONAS.maria.money, known: 'fuelLei' } };
    expect(parseProfile(JSON.stringify(bad))).toBeUndefined();
    const ok = { ...PERSONAS.maria, money: { ...PERSONAS.maria.money, known: ['fuelLei'] } };
    expect(parseProfile(JSON.stringify(ok))).toEqual(ok);
  });

  it('reads back a valid profile unchanged', () => {
    expect(parseProfile(JSON.stringify(PERSONAS.maria))).toEqual(PERSONAS.maria);
  });

  it('keeps lessons in progress, and drops a broken progress block without losing the profile', () => {
    const ok = { ...PERSONAS.maria, lessonProgress: { etf: { step: 2, results: [true, false], of: 7 } } };
    expect(parseProfile(JSON.stringify(ok))).toEqual(ok);
    const bad = { ...PERSONAS.maria, lessonProgress: { etf: { step: 'two', results: [], of: 7 } } };
    expect(parseProfile(JSON.stringify(bad))).toEqual(PERSONAS.maria);
  });

  it('keeps the game block, and drops a broken one without losing the profile', () => {
    const game = { xp: 120, streak: 2, best: 3, lastDay: '2026-10-28', days: ['2026-10-27', '2026-10-28'], badges: ['first'] };
    expect(parseProfile(JSON.stringify({ ...PERSONAS.maria, game }))?.game).toEqual(game);
    const broken = parseProfile(JSON.stringify({ ...PERSONAS.maria, game: { ...game, xp: 'lots' } }));
    expect(broken?.game).toBeUndefined();
    expect(broken?.level).toBe(PERSONAS.maria.level);
  });
});
