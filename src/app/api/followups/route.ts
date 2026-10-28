import { NextResponse } from 'next/server';
import { dueFollowUps } from '@/lib/service';
import { currentUserId } from '@/lib/session';
import { getStore } from '@/lib/store';

/** Actions whose 7-day check is due. An action only counts once the user confirms it. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'no user' }, { status: 401 });
  return NextResponse.json({ due: await dueFollowUps(await getStore(), userId) });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'no user' }, { status: 401 });
  const { actionId, status } = (await req.json()) as { actionId: string; status: 'confirmed' | 'skipped' };
  if (status !== 'confirmed' && status !== 'skipped') return NextResponse.json({ error: 'bad status' }, { status: 400 });
  const store = await getStore();
  const mine = (await store.listActions(userId)).find((a) => a.id === actionId);
  if (!mine) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ action: await store.updateAction(actionId, { status }) });
}
