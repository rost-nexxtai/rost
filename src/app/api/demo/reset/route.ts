import { NextResponse } from 'next/server';
import { setOffsetDays } from '@/lib/clock';
import { resetDemoStore } from '@/lib/store';

/** Stage helper: back to a fresh Maria and today's date. Demo mode only. */
export async function POST() {
  if (!resetDemoStore()) return NextResponse.json({ error: 'reset is demo-only' }, { status: 403 });
  setOffsetDays(0);
  return NextResponse.json({ ok: true });
}
