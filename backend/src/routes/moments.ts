import { Hono } from 'hono';
import type { FollowUpRequest, FollowUpsResponse, MomentPostRequest, MomentResponse, TodayResponse } from '../contract';
import { fillSteps } from '../lib/moments/engine';
import { momentDefs } from '../lib/reference';
import { completeWithAction, dueFollowUps, getRunWithView, recordGuess } from '../lib/service';
import { getStore } from '../lib/store';
import { currentUserId } from '../session';

export const moments = new Hono();

/** Everything the Today screen shows, in one call. */
moments.get('/today', async (c) => {
  const userId = currentUserId(c);
  const store = await getStore();
  const user = userId ? await store.getUser(userId) : undefined;
  if (!user) return c.json({ error: 'no user' }, 401);

  const runs = await store.listRuns(user.id);
  const open = runs.filter((r) => r.state === 'pending' || r.state === 'started');
  const done = new Set(runs.filter((r) => r.state === 'completed').map((r) => r.momentId));
  const defs = momentDefs();
  const catchUp = defs.filter((d) => !done.has(d.id) && !open.some((r) => r.momentId === d.id) && d.triggers[0] !== 'shock_scenario');

  return c.json({
    user,
    open,
    moments: defs,
    doneMomentIds: [...done],
    catchUpMomentIds: catchUp.map((d) => d.id),
    dueFollowUps: await dueFollowUps(store, user.id),
  } satisfies TodayResponse);
});

moments.get('/moments/:runId', async (c) => {
  const userId = currentUserId(c);
  if (!userId) return c.json({ error: 'no user' }, 401);
  const data = await getRunWithView(await getStore(), c.req.param('runId'), userId);
  if (!data) return c.json({ error: 'not found' }, 404);
  return c.json({ ...data, def: fillSteps(data.def, data.view.vars) } satisfies MomentResponse);
});

moments.post('/moments/:runId', async (c) => {
  const userId = currentUserId(c);
  if (!userId) return c.json({ error: 'no user' }, 401);
  const runId = c.req.param('runId');
  const store = await getStore();
  const loaded = await getRunWithView(store, runId, userId);
  if (!loaded) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<MomentPostRequest>();

  if (body.kind === 'guess') {
    const answer = loaded.view.answers[body.answerKey];
    if (answer === undefined) return c.json({ error: 'unknown answer key' }, 400);
    const run = await recordGuess(store, runId, userId, Number(body.value), answer);
    return c.json({ run, answer });
  }
  if (body.kind === 'action') {
    const action = await completeWithAction(store, {
      runId, userId, actionType: body.actionType, params: body.params, followUpDays: loaded.def.followUpDays,
    });
    return c.json({ action });
  }
  if (body.kind === 'dismiss') {
    return c.json({ run: await store.updateRun(runId, { state: 'dismissed' }) });
  }
  return c.json({ error: 'unknown kind' }, 400);
});

/** Actions whose 7-day check is due. An action only counts once the user confirms it. */
moments.get('/followups', async (c) => {
  const userId = currentUserId(c);
  if (!userId) return c.json({ error: 'no user' }, 401);
  return c.json({ due: await dueFollowUps(await getStore(), userId) } satisfies FollowUpsResponse);
});

moments.post('/followups', async (c) => {
  const userId = currentUserId(c);
  if (!userId) return c.json({ error: 'no user' }, 401);
  const { actionId, status } = await c.req.json<FollowUpRequest>();
  if (status !== 'confirmed' && status !== 'skipped') return c.json({ error: 'bad status' }, 400);
  const store = await getStore();
  const mine = (await store.listActions(userId)).find((a) => a.id === actionId);
  if (!mine) return c.json({ error: 'not found' }, 404);
  return c.json({ action: await store.updateAction(actionId, { status }) });
});
