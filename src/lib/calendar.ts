import { latestCpi } from './reference';
import { daysBetween, pillar2Deadline } from './rules';
import type { EventType, User } from './store/types';

export interface CalendarEvent {
  type: EventType;
  payload: Record<string, unknown>;
}

/**
 * Events the calendar knows without any bank data: payday, the Pillar II deadline (from the hire date)
 * and a fresh INS inflation release. Run once a day per user (cron), or from the simulator.
 */
export function calendarEvents(user: User, todayIso: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const day = Number(todayIso.slice(8, 10));

  if (user.payday && day === user.payday && user.situations.includes('employed')) {
    out.push({ type: 'salary_received', payload: { from: 'calendar' } });
  }

  if (user.hireDate && user.situations.includes('employed')) {
    const deadline = pillar2Deadline(user.hireDate);
    const left = daysBetween(todayIso, deadline);
    if (left >= 0 && left <= 30) out.push({ type: 'pillar2_deadline_near', payload: { deadline, daysLeft: left } });
  }

  const cpi = latestCpi();
  const sinceRelease = daysBetween(cpi.publishedAt, todayIso);
  if (sinceRelease >= 0 && sinceRelease <= 2) {
    out.push({ type: 'inflation_published', payload: { period: cpi.period } });
  }
  return out;
}
