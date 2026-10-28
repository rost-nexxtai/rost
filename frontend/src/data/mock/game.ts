// MOCK until the backend keeps progress: XP, the daily streak and badges live in the profile cookie.
import type { BadgeId, GameState } from '../types';

/** XP for each kind of answer, and the bonuses a finished lesson adds. */
export const XP = {
  /** A choice, guess or order right the first time. */
  right: 10,
  /** One sorting card in the right bucket. */
  card: 4,
  /** Right on the second try: you still learned it. */
  secondTry: 5,
  finish: 20,
  /** Every graded screen right the first time. */
  perfect: 20,
  /** COMBO_BONUS_AT answers in a row without a slip. */
  combo: 15,
} as const;
export const COMBO_BONUS_AT = 5;
/** The most answer XP one lesson can hand in; anything above is a tampered request. */
const MAX_ANSWER_XP = 120;
/** Active days kept, enough for the week strip and a bit more. */
const KEEP_DAYS = 14;

export type XpPart = { key: 'answers' | 'finish' | 'perfect' | 'combo'; xp: number };

/** XP for one finished lesson. A replay of a lesson already done earns half. */
export function lessonXp(l: { answerXp: number; perfect: boolean; maxCombo: number; replay: boolean }): { total: number; parts: XpPart[] } {
  const parts: XpPart[] = [
    { key: 'answers', xp: Math.max(0, Math.min(MAX_ANSWER_XP, Math.round(l.answerXp))) },
    { key: 'finish', xp: XP.finish },
  ];
  if (l.perfect) parts.push({ key: 'perfect', xp: XP.perfect });
  if (l.maxCombo >= COMBO_BONUS_AT) parts.push({ key: 'combo', xp: XP.combo });
  const scaled = l.replay ? parts.map((p) => ({ ...p, xp: Math.round(p.xp / 2) })) : parts;
  return { total: scaled.reduce((s, p) => s + p.xp, 0), parts: scaled.filter((p) => p.xp > 0) };
}

/** The calendar day in Romania, as YYYY-MM-DD: a streak follows the user's days, not UTC's. */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** The day before (or `n` days before) a YYYY-MM-DD day. */
export function dayBefore(day: string, n = 1): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

export const EMPTY_GAME: GameState = { xp: 0, streak: 0, best: 0, days: [], badges: [] };

/** The streak as of `today`: it survives until the end of the day after the last lesson. */
export function streakOn(g: GameState | undefined, today: string): { days: number; doneToday: boolean; atRisk: boolean } {
  if (!g?.lastDay) return { days: 0, doneToday: false, atRisk: false };
  const doneToday = g.lastDay === today;
  const alive = doneToday || g.lastDay === dayBefore(today);
  return { days: alive ? g.streak : 0, doneToday, atRisk: alive && !doneToday };
}

/** Monday to Sunday of the week holding `today`, with the days a lesson was finished. */
export function weekOf(g: GameState | undefined, today: string): { day: string; active: boolean; today: boolean; future: boolean }[] {
  const [y, m, d] = today.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  const active = new Set(g?.days ?? []);
  return Array.from({ length: 7 }, (_, i) => {
    const day = dayBefore(today, weekday - i);
    return { day, active: active.has(day), today: day === today, future: i > weekday };
  });
}

export interface LessonReward {
  xp: number;
  parts: XpPart[];
  totalXp: number;
  streak: number;
  /** This lesson started or extended the streak (the first one today). */
  streakUp: boolean;
  newBadges: BadgeId[];
  week: ReturnType<typeof weekOf>;
}

/**
 * Adds a finished lesson to the game state. Finishing counts for the streak even when the lesson
 * wasn't passed: showing up is the habit we want; the level still needs the right answers.
 */
export function recordLesson(
  before: GameState | undefined,
  l: { today: string; answerXp: number; perfect: boolean; maxCombo: number; replay: boolean; levelUp: boolean },
): { game: GameState; reward: LessonReward } {
  const g = before ?? EMPTY_GAME;
  const { total, parts } = lessonXp(l);
  const streakUp = g.lastDay !== l.today;
  const streak = !streakUp ? g.streak : g.lastDay === dayBefore(l.today) ? g.streak + 1 : 1;
  const days = g.days.includes(l.today) ? g.days : [...g.days, l.today].slice(-KEEP_DAYS);
  const next: GameState = { xp: g.xp + total, streak, best: Math.max(g.best, streak), lastDay: l.today, days, badges: g.badges };
  const earned = BADGES.filter((b) => !g.badges.includes(b.id) && b.earned(next, l)).map((b) => b.id);
  const game = { ...next, badges: [...g.badges, ...earned] };
  return { game, reward: { xp: total, parts, totalXp: game.xp, streak, streakUp, newBadges: earned, week: weekOf(game, l.today) } };
}

/** Badges in the order they are shown. The names live with the screens that show them. */
export const BADGES: { id: BadgeId; earned: (g: GameState, l: { perfect: boolean; levelUp: boolean; maxCombo: number }) => boolean }[] = [
  { id: 'first', earned: () => true },
  { id: 'perfect', earned: (_, l) => l.perfect },
  { id: 'combo', earned: (_, l) => l.maxCombo >= COMBO_BONUS_AT },
  { id: 'streak3', earned: (g) => g.streak >= 3 },
  { id: 'streak7', earned: (g) => g.streak >= 7 },
  { id: 'levelUp', earned: (_, l) => l.levelUp },
  { id: 'xp500', earned: (g) => g.xp >= 500 },
];

const BADGE_IDS: unknown[] = BADGES.map((b) => b.id);
const isDay = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isCount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** A game block from the cookie, or undefined when it's missing or doesn't look right. */
export function validGame(v: unknown): v is GameState {
  if (!v || typeof v !== 'object') return false;
  const g = v as Partial<GameState>;
  return (
    isCount(g.xp) &&
    isCount(g.streak) &&
    isCount(g.best) &&
    (g.lastDay === undefined || isDay(g.lastDay)) &&
    Array.isArray(g.days) &&
    g.days.every(isDay) &&
    Array.isArray(g.badges) &&
    g.badges.every((b) => BADGE_IDS.includes(b))
  );
}
