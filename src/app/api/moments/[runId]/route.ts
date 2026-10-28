import { NextResponse } from 'next/server';
import { completeWithAction, getRunWithView, recordGuess } from '@/lib/service';
import { currentUserId } from '@/lib/session';
import { getStore } from '@/lib/store';

type Ctx = { params: Promise<{ runId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'no user' }, { status: 401 });
  const data = await getRunWithView(await getStore(), (await params).runId, userId);
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}

type Body =
  | { kind: 'guess'; value: number; answerKey: string }
  | { kind: 'action'; actionType: string; params: Record<string, unknown> }
  | { kind: 'dismiss' };

export async function POST(req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'no user' }, { status: 401 });
  const { runId } = await params;
  const store = await getStore();
  const loaded = await getRunWithView(store, runId, userId);
  if (!loaded) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = (await req.json()) as Body;

  if (body.kind === 'guess') {
    const answer = loaded.view.answers[body.answerKey];
    if (answer === undefined) return NextResponse.json({ error: 'unknown answer key' }, { status: 400 });
    const run = await recordGuess(store, runId, userId, Number(body.value), answer);
    return NextResponse.json({ run, answer });
  }
  if (body.kind === 'action') {
    const action = await completeWithAction(store, {
      runId, userId, actionType: body.actionType, params: body.params, followUpDays: loaded.def.followUpDays,
    });
    return NextResponse.json({ action });
  }
  if (body.kind === 'dismiss') {
    return NextResponse.json({ run: await store.updateRun(runId, { state: 'dismissed' }) });
  }
  return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
}
