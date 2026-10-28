import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookieOptions, UID_COOKIE } from '@/lib/session';
import { getStore } from '@/lib/store';
import type { FirstDone, Situation, SpendingProfile } from '@/lib/store';

interface Body {
  demo?: string;
  name?: string;
  situations?: Situation[];
  payday?: number;
  hireDate?: string;
  grossMonthly?: number;
  monthlyExpenses?: number;
  firstsDone?: FirstDone[];
  spending?: SpendingProfile;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const store = await getStore();

  let userId: string;
  if (body.demo) {
    const existing = await store.getUser(body.demo);
    if (!existing) return NextResponse.json({ error: 'demo user not found (run npm run db:migrate in db mode)' }, { status: 404 });
    userId = existing.id;
  } else {
    if (!body.situations?.length) return NextResponse.json({ error: 'pick at least one situation' }, { status: 400 });
    const user = await store.createUser({
      id: randomUUID(),
      name: body.name,
      situations: body.situations,
      payday: body.payday,
      hireDate: body.hireDate || undefined,
      grossMonthly: body.grossMonthly,
      monthlyExpenses: body.monthlyExpenses,
      firstsDone: body.firstsDone ?? [],
      spending: body.spending,
    });
    userId = user.id;
  }

  const res = NextResponse.json({ userId });
  res.cookies.set(UID_COOKIE, userId, cookieOptions);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(UID_COOKIE);
  return res;
}
