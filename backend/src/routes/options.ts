import { Hono } from 'hono';
import type { OptionsResponse } from '../contract';
import { latestCpi, offers } from '../lib/reference';
import { personalInflation, rankOffers, realChange, type Horizon } from '../lib/rules';
import { getStore } from '../lib/store';
import { currentUserId } from '../session';

export const options = new Hono();

const HORIZONS: Horizon[] = ['any_time', 'one_to_two_years', 'later'];

/**
 * Neutral ranking. Order = public formula only; partner status is never an input (see ranking.test.ts).
 * Works without a session: then it compares against national inflation.
 */
options.get('/options', async (c) => {
  const h = c.req.query('horizon') as Horizon;
  const horizon = HORIZONS.includes(h) ? h : 'one_to_two_years';
  const amount = Number(c.req.query('amount'));
  const amountLei = amount > 0 ? amount : 10000;

  const userId = currentUserId(c);
  const user = userId ? await (await getStore()).getUser(userId) : undefined;
  const cpi = latestCpi();
  const inflationPct = user?.spending ? personalInflation(user.spending.shares, cpi.groupsPct).personalPct : cpi.headlinePct;

  const ranked = rankOffers(offers(), { horizon, amountLei });
  return c.json({
    horizon,
    amountLei,
    inflationPct,
    personalInflation: Boolean(user?.spending),
    offers: ranked.map((o) => ({ ...o, realChangeLei: realChange(amountLei, o.netRatePct, inflationPct) })),
  } satisfies OptionsResponse);
});
