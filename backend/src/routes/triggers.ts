import { Hono } from 'hono';
import type { CalendarResponse, ClockResponse, EventRequest } from '../contract';
import { calendarEvents } from '../lib/calendar';
import { getOffsetDays, nowIso, setOffsetDays, todayIso } from '../lib/clock';
import { handleEvent } from '../lib/service';
import { getStore, resetDemoStore, type EventType } from '../lib/store';
import { currentUserId } from '../session';

export const triggers = new Hono();

const ALLOWED: EventType[] = [
  'salary_received',
  'payslip_uploaded',
  'pillar2_deadline_near',
  'inflation_published',
  'shock_scenario',
  'graduated',
  'raise',
  'catch_up',
];

/** Fire an event for the current user (simulator, catch-up button, or a future bank webhook adapter). */
triggers.post('/events', async (c) => {
  const userId = currentUserId(c);
  if (!userId) return c.json({ error: 'no user' }, 401);
  const body = await c.req.json<EventRequest>();
  if (!ALLOWED.includes(body.type)) return c.json({ error: 'unknown event type' }, 400);

  const result = await handleEvent(await getStore(), {
    userId,
    type: body.type,
    payload: body.payload,
    source: body.type === 'catch_up' ? 'user' : 'simulator',
    ignoreWeeklyCap: body.ignoreWeeklyCap,
  });
  return c.json(result);
});

/**
 * Runs today's calendar for the current user. In production this is a daily cron over all users;
 * here the simulator calls it so the trigger on stage is computed, not pressed.
 */
triggers.post('/calendar', async (c) => {
  const userId = currentUserId(c);
  if (!userId) return c.json({ error: 'no user' }, 401);
  const store = await getStore();
  const user = await store.getUser(userId);
  if (!user) return c.json({ error: 'no user' }, 401);

  const today = todayIso();
  const results = [];
  for (const ev of calendarEvents(user, today)) {
    results.push(await handleEvent(store, { userId, type: ev.type, payload: ev.payload, source: 'calendar' }));
  }
  return c.json({ today, results } satisfies CalendarResponse);
});

/** Demo only: move the app clock forward (e.g. "7 days later" for follow-ups). */
triggers.get('/clock', (c) => c.json({ offsetDays: getOffsetDays(), now: nowIso() } satisfies ClockResponse));

triggers.post('/clock', async (c) => {
  if (process.env.ALLOW_DEMO_TOKEN !== 'true' && process.env.DATA_MODE === 'db') {
    return c.json({ error: 'clock is demo-only' }, 403);
  }
  const { days } = await c.req.json<{ days: number }>();
  setOffsetDays(Number(days) || 0);
  return c.json({ offsetDays: getOffsetDays(), now: nowIso() } satisfies ClockResponse);
});

/** Stage helper: back to a fresh Maria and today's date. Demo mode only. */
triggers.post('/demo/reset', (c) => {
  if (!resetDemoStore()) return c.json({ error: 'reset is demo-only' }, 403);
  setOffsetDays(0);
  return c.json({ ok: true });
});
