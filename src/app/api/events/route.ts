import { NextResponse } from 'next/server';
import { handleEvent } from '@/lib/service';
import { currentUserId } from '@/lib/session';
import { getStore, type EventType } from '@/lib/store';

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
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'no user' }, { status: 401 });
  const body = (await req.json()) as { type: EventType; payload?: Record<string, unknown>; ignoreWeeklyCap?: boolean };
  if (!ALLOWED.includes(body.type)) return NextResponse.json({ error: 'unknown event type' }, { status: 400 });

  const result = await handleEvent(await getStore(), {
    userId,
    type: body.type,
    payload: body.payload,
    source: body.type === 'catch_up' ? 'user' : 'simulator',
    ignoreWeeklyCap: body.ignoreWeeklyCap,
  });
  return NextResponse.json(result);
}
