import { RULES_2026 } from './constants';

/** Adds whole months to an ISO date (YYYY-MM-DD), clamping to the month's last day. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const t = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso` (negative if `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Last day to choose a Pillar II fund: hire date + 4 months, minus one day.
 * Example: hired 2026-09-01 -> choose by 2026-12-31.
 * Rule to re-verify each year with the finance reviewer.
 */
export function pillar2Deadline(hireDateIso: string): string {
  return addDays(addMonths(hireDateIso, RULES_2026.pillar2ChoiceMonths), -1);
}
