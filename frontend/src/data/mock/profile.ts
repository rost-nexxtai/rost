// MOCK until backend ships the profile on GET /api/me. The profile lives in a cookie until then.
import type { Profile } from '../types';
import { validDays } from './rhythm';

export const PROFILE_COOKIE = 'rost_profile';
export const PROFILE_COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 90 };

const RISK = ['prudent', 'echilibrat', 'dinamic'];
const LINES: unknown[] = ['fuelLei', 'electricityLei', 'savedLei'];
const isLevel = (v: unknown) => v === 0 || v === 1 || v === 2;
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** A corrupt, old or hand-edited cookie is "no profile", never an error. */
export function parseProfile(raw: string | undefined): Profile | undefined {
  if (!raw) return undefined;
  let p: Partial<Profile> & { money?: Partial<Profile['money']> };
  try {
    p = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!p || typeof p !== 'object') return undefined;
  const ok =
    isLevel(p.level) &&
    isLevel(p.quizLevel) &&
    RISK.includes(p.riskProfile as string) &&
    isNum(p.quizScore) &&
    isNum(p.bufferMonths) &&
    typeof p.expensiveDebt === 'boolean' &&
    !!p.money &&
    isNum(p.money.fuelLei) &&
    isNum(p.money.electricityLei) &&
    isNum(p.money.savedLei) &&
    isNum(p.money.inflationPct) &&
    (p.money.known === undefined || (Array.isArray(p.money.known) && p.money.known.every((l) => LINES.includes(l)))) &&
    Array.isArray(p.completedMomentIds) &&
    p.completedMomentIds.every((id) => typeof id === 'string');
  if (!ok) return undefined;
  const profile = p as Profile;
  if (profile.lessonProgress !== undefined && !validProgress(profile.lessonProgress)) delete profile.lessonProgress;
  if (profile.learnedDays !== undefined && !validDays(profile.learnedDays)) delete profile.learnedDays;
  // XP and badges were tried briefly and dropped; don't carry them along
  delete (profile as { game?: unknown }).game;
  return profile;
}

function validProgress(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v).every(
    (x) =>
      !!x &&
      Number.isInteger(x.step) &&
      x.step >= 0 &&
      Number.isInteger(x.of) &&
      Array.isArray(x.results) &&
      x.results.every((r: unknown) => typeof r === 'boolean'),
  );
}
