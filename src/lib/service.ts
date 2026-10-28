import { randomUUID } from 'node:crypto';
import { nowIso } from './clock';
import { decide, type Decision } from './moments/engine';
import { buildView } from './moments/views';
import { getPartner, momentDefs, offers } from './reference';
import type { AppEvent, EventSource, EventType, MomentRun, Store } from './store/types';

/**
 * Application services shared by API routes and tests.
 * Every trigger (simulator, calendar, bank, user) goes through handleEvent.
 */
export async function handleEvent(
  store: Store,
  input: { userId: string; type: EventType; payload?: Record<string, unknown>; source: EventSource; ignoreWeeklyCap?: boolean },
): Promise<{ event: AppEvent; decision: Decision; runs: MomentRun[] }> {
  const user = await store.getUser(input.userId);
  if (!user) throw new Error(`user ${input.userId} not found`);
  const event = await store.addEvent({ userId: user.id, type: input.type, payload: input.payload ?? {}, source: input.source });
  const decision = decide(momentDefs(), user, event, await store.listRuns(user.id), nowIso(), {
    ignoreWeeklyCap: input.ignoreWeeklyCap,
  });
  const runs: MomentRun[] = [];
  for (const momentId of decision.open) {
    runs.push(await store.createRun({ userId: user.id, momentId, triggerEventId: event.id, state: 'pending' }));
  }
  return { event, decision, runs };
}

export async function getRunWithView(store: Store, runId: string, userId: string) {
  const run = await store.getRun(runId);
  if (!run || run.userId !== userId) return undefined;
  const user = await store.getUser(userId);
  if (!user) return undefined;
  const def = momentDefs().find((d) => d.id === run.momentId);
  if (!def) return undefined;
  const events = run.triggerEventId ? await store.listEvents(userId) : [];
  const trigger = events.find((e) => e.id === run.triggerEventId);
  const view = buildView(user, trigger?.payload ?? {});
  if (run.state === 'pending') await store.updateRun(run.id, { state: 'started', startedAt: nowIso() });
  return { run, def, view };
}

export async function recordGuess(store: Store, runId: string, userId: string, guess: number, answer: number) {
  const run = await store.getRun(runId);
  if (!run || run.userId !== userId) throw new Error('run not found');
  return store.updateRun(runId, { guess, result: { ...(run.result ?? {}), answer } });
}

export async function completeWithAction(
  store: Store,
  input: { runId: string; userId: string; actionType: string; params: Record<string, unknown>; followUpDays: number },
) {
  const run = await store.getRun(input.runId);
  if (!run || run.userId !== input.userId) throw new Error('run not found');
  const followUpAt = new Date(Date.parse(nowIso()) + input.followUpDays * 86_400_000).toISOString();
  const action = await store.createAction({
    userId: input.userId,
    momentRunId: run.id,
    type: input.actionType,
    params: input.params,
    status: 'set',
    followUpAt,
  });
  await store.updateRun(run.id, { state: 'completed', completedAt: nowIso() });

  // Mark the matching "first" as done so catch-up lists stay accurate.
  const firstFor: Record<string, 'payslip' | 'savings'> = { payslip_explained: 'payslip', personal_inflation: 'savings' };
  const first = firstFor[run.momentId];
  const user = await store.getUser(input.userId);
  if (first && user && !user.firstsDone.includes(first)) {
    await store.updateUser(user.id, { firstsDone: [...user.firstsDone, first] });
  }
  return action;
}

export async function dueFollowUps(store: Store, userId: string) {
  const t = Date.parse(nowIso());
  return (await store.listActions(userId)).filter((a) => a.status === 'set' && Date.parse(a.followUpAt) <= t);
}

/** Referral click: records it and returns where to send the user. */
export async function trackReferralClick(store: Store, offerId: string, userId?: string) {
  const offer = offers().find((o) => o.id === offerId);
  if (!offer) throw new Error('unknown offer');
  const clickId = randomUUID();
  await store.createReferral({
    clickId,
    userId,
    offerId,
    partnerId: offer.partnerId ?? undefined,
    status: 'clicked',
    feeLei: 0,
  });
  return { clickId, offer };
}

/** Partner postback. A fee is earned only when a partner's account is funded. */
export async function referralPostback(store: Store, clickId: string, status: 'opened' | 'funded') {
  const ref = await store.getReferralByClick(clickId);
  if (!ref) throw new Error('unknown click');
  const partner = getPartner(ref.partnerId);
  const feeLei = status === 'funded' && partner ? partner.feePerFundedLei : ref.feeLei;
  return store.updateReferral(clickId, { status, feeLei });
}
