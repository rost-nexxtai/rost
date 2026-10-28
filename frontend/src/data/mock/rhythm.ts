// MOCK until the backend keeps progress: the days with a finished lesson live in the profile cookie.

/** Days kept, enough for this week and the one before. */
const KEEP_DAYS = 14;

/** The calendar day in Romania, as YYYY-MM-DD, so "this week" follows the user's days, not UTC's. */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** The day `n` days before a YYYY-MM-DD day. */
export function dayBefore(day: string, n = 1): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

/** Adds today to the days with a finished lesson, once, keeping the last two weeks. */
export function withDay(days: string[] | undefined, today: string): string[] {
  const all = days ?? [];
  return all.includes(today) ? all : [...all, today].slice(-KEEP_DAYS);
}

export type WeekDay = { day: string; active: boolean; today: boolean; future: boolean };

/** Monday to Sunday of the week holding `today`, marking the days a lesson was finished. */
export function weekOf(days: string[] | undefined, today: string): WeekDay[] {
  const [y, m, d] = today.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  const active = new Set(days ?? []);
  return Array.from({ length: 7 }, (_, i) => {
    const day = dayBefore(today, weekday - i);
    return { day, active: active.has(day), today: day === today, future: i > weekday };
  });
}

/** A list of YYYY-MM-DD days from the cookie, or false when it doesn't look right. */
export function validDays(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
}
