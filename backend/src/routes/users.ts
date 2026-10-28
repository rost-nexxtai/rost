import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { CreateUserRequest, CreateUserResponse, MeResponse } from '../contract';
import { getStore } from '../lib/store';
import { clearUserId, currentUserId, setUserId } from '../session';

export const users = new Hono();

users.post('/users', async (c) => {
  const body = await c.req.json<CreateUserRequest>();
  const store = await getStore();

  let userId: string;
  if (body.demo) {
    const existing = await store.getUser(body.demo);
    if (!existing) return c.json({ error: 'demo user not found (run npm run db:migrate in db mode)' }, 404);
    userId = existing.id;
  } else {
    if (!body.situations?.length) return c.json({ error: 'pick at least one situation' }, 400);
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

  setUserId(c, userId);
  return c.json({ userId } satisfies CreateUserResponse);
});

users.delete('/users', (c) => {
  clearUserId(c);
  return c.json({ ok: true });
});

users.get('/me', async (c) => {
  const userId = currentUserId(c);
  const user = userId ? await (await getStore()).getUser(userId) : undefined;
  if (!user) return c.json({ error: 'no user' }, 401);
  return c.json({ user } satisfies MeResponse);
});
