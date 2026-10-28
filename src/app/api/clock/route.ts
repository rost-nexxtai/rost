import { NextResponse } from 'next/server';
import { getOffsetDays, nowIso, setOffsetDays } from '@/lib/clock';

/** Demo only: move the app clock forward (e.g. "7 days later" for follow-ups). */
export async function GET() {
  return NextResponse.json({ offsetDays: getOffsetDays(), now: nowIso() });
}

export async function POST(req: Request) {
  if (process.env.ALLOW_DEMO_TOKEN !== 'true' && process.env.DATA_MODE === 'db') {
    return NextResponse.json({ error: 'clock is demo-only' }, { status: 403 });
  }
  const { days } = (await req.json()) as { days: number };
  setOffsetDays(Number(days) || 0);
  return NextResponse.json({ offsetDays: getOffsetDays(), now: nowIso() });
}
