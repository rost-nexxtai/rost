/**
 * App clock with a demo offset, so the simulator can jump forward ("7 days later")
 * without touching the system time.
 */
const g = globalThis as unknown as { __rostClockOffsetDays?: number };

export function getOffsetDays(): number {
  return g.__rostClockOffsetDays ?? 0;
}

export function setOffsetDays(days: number): void {
  g.__rostClockOffsetDays = Math.max(0, Math.round(days));
}

export function now(): Date {
  return new Date(Date.now() + getOffsetDays() * 86_400_000);
}

export function nowIso(): string {
  return now().toISOString();
}

export function todayIso(): string {
  return nowIso().slice(0, 10);
}
