import { describe, expect, it } from 'vitest';
import { dayBefore, dayKey, EMPTY_GAME, lessonXp, recordLesson, streakOn, validGame, weekOf, XP } from './game';

const lesson = { answerXp: 30, perfect: false, maxCombo: 2, replay: false, levelUp: false };

describe('XP', () => {
  it('pays for answers and for finishing, with bonuses for a perfect run and a long combo', () => {
    expect(lessonXp(lesson)).toEqual({ total: 30 + XP.finish, parts: [{ key: 'answers', xp: 30 }, { key: 'finish', xp: XP.finish }] });
    expect(lessonXp({ ...lesson, perfect: true, maxCombo: 5 }).total).toBe(30 + XP.finish + XP.perfect + XP.combo);
  });

  it('pays half for a replay, and caps what one lesson can claim', () => {
    expect(lessonXp({ ...lesson, replay: true }).total).toBe(15 + XP.finish / 2);
    expect(lessonXp({ ...lesson, answerXp: 10_000 }).parts[0].xp).toBe(120);
    expect(lessonXp({ ...lesson, answerXp: -5 }).parts.map((p) => p.key)).toEqual(['finish']);
  });
});

describe('days', () => {
  it('uses the Romanian calendar day', () => {
    // 23:30 UTC on 28 Oct is already 29 Oct in Bucharest (UTC+2)
    expect(dayKey(new Date('2026-10-28T23:30:00Z'))).toBe('2026-10-29');
    expect(dayKey(new Date('2026-10-28T21:30:00Z'))).toBe('2026-10-28');
  });

  it('steps back across months and years', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
    expect(dayBefore('2026-10-29', 3)).toBe('2026-10-26');
  });
});

describe('streak', () => {
  const play = (g: typeof EMPTY_GAME | undefined, today: string, extra = {}) => recordLesson(g, { ...lesson, today, ...extra });

  it('starts at one, grows on the next day, and counts a day once', () => {
    const a = play(undefined, '2026-10-26');
    expect(a.reward).toMatchObject({ streak: 1, streakUp: true });
    const b = play(a.game, '2026-10-26');
    expect(b.reward).toMatchObject({ streak: 1, streakUp: false });
    const c = play(b.game, '2026-10-27');
    expect(c.reward).toMatchObject({ streak: 2, streakUp: true });
    expect(c.game.days).toEqual(['2026-10-26', '2026-10-27']);
    expect(c.game.xp).toBe(3 * (30 + XP.finish));
  });

  it('starts over after a missed day, but keeps the best', () => {
    const a = play(play(undefined, '2026-10-26').game, '2026-10-27');
    const b = play(a.game, '2026-10-29');
    expect(b.game).toMatchObject({ streak: 1, best: 2 });
  });

  it('stays alive until the end of the next day, and says when it is at risk', () => {
    const g = play(undefined, '2026-10-27').game;
    expect(streakOn(g, '2026-10-27')).toEqual({ days: 1, doneToday: true, atRisk: false });
    expect(streakOn(g, '2026-10-28')).toEqual({ days: 1, doneToday: false, atRisk: true });
    expect(streakOn(g, '2026-10-29')).toEqual({ days: 0, doneToday: false, atRisk: false });
    expect(streakOn(undefined, '2026-10-29').days).toBe(0);
  });

  it('shows the week from Monday, with the active days', () => {
    // 28 Oct 2026 is a Wednesday
    const g = play(play(undefined, '2026-10-26').game, '2026-10-28').game;
    const week = weekOf(g, '2026-10-28');
    expect(week.map((d) => d.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(week.map((d) => d.active)).toEqual([true, false, true, false, false, false, false]);
    expect(week.findIndex((d) => d.today)).toBe(2);
    expect(week.filter((d) => d.future).length).toBe(4);
  });
});

describe('badges', () => {
  it('hands each badge out once, when it is earned', () => {
    const a = recordLesson(undefined, { ...lesson, today: '2026-10-26', perfect: true });
    expect(a.reward.newBadges).toEqual(['first', 'perfect']);
    const b = recordLesson(a.game, { ...lesson, today: '2026-10-27', perfect: true, levelUp: true });
    expect(b.reward.newBadges).toEqual(['levelUp']);
    const c = recordLesson(b.game, { ...lesson, today: '2026-10-28', maxCombo: 6 });
    expect(c.reward.newBadges).toEqual(['combo', 'streak3']);
  });
});

describe('game block in the cookie', () => {
  it('accepts a real one and rejects a hand-edited one', () => {
    expect(validGame(recordLesson(undefined, { ...lesson, today: '2026-10-26' }).game)).toBe(true);
    expect(validGame({ ...EMPTY_GAME, xp: -1 })).toBe(false);
    expect(validGame({ ...EMPTY_GAME, badges: ['admin'] })).toBe(false);
    expect(validGame({ ...EMPTY_GAME, days: ['yesterday'] })).toBe(false);
    expect(validGame(null)).toBe(false);
  });
});
