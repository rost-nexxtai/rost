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

  it('keeps the learned days, and drops a broken list or an old game block without losing the profile', () => {
    const days = ['2026-10-27', '2026-10-28'];
    expect(parseProfile(JSON.stringify({ ...PERSONAS.maria, learnedDays: days }))?.learnedDays).toEqual(days);
    const broken = parseProfile(JSON.stringify({ ...PERSONAS.maria, learnedDays: ['soon'], game: { xp: 10 } }));
    expect(broken?.learnedDays).toBeUndefined();
    expect(broken).not.toHaveProperty('game');
    expect(broken?.level).toBe(PERSONAS.maria.level);
  });
});
