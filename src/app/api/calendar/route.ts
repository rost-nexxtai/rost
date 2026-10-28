import { NextResponse } from 'next/server';
import { calendarEvents } from '@/lib/calendar';
import { todayIso } from '@/lib/clock';
import { handleEvent } from '@/lib/service';
import { currentUserId } from '@/lib/session';
import { getStore } from '@/lib/store';

/**
 * Runs today's calendar for the current user. In production this is a daily cron over all users;
 * here the simulator calls it so the trigger on stage is computed, not pressed.
 */
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'no user' }, { status: 401 });
  const store = await getStore();
  const user = await store.getUser(userId);
  if (!user) return NextResponse.json({ error: 'no user' }, { status: 401 });

  const today = todayIso();
  const results = [];
  for (const ev of calendarEvents(user, today)) {
    results.push(await handleEvent(store, { userId, type: ev.type, payload: ev.payload, source: 'calendar' }));
  }
  return NextResponse.json({ today, results });
}
