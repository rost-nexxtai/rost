import { Hono } from 'hono';
import demoUsers from '../../data/seed/demo-users.json';
import type { DemoTokenResponse, EmbedResponse } from '../contract';
import { inflationView } from '../lib/moments/views';
import { signPartnerToken, verifyPartnerToken, type PartnerClaims } from '../lib/partner-token';
import { getPartner, getScenario } from '../lib/reference';
import { publicPartner } from './referrals';

export const partner = new Hono();

/**
 * Stage demo only. A real bank signs this token on its own servers with its own secret,
 * from category shares it computes from its customer's card spending.
 */
partner.get('/partner/demo-token', async (c) => {
  if (process.env.ALLOW_DEMO_TOKEN !== 'true') return c.json({ error: 'disabled' }, 403);
  const maria = demoUsers.users[0];
  const token = await signPartnerToken({
    partnerId: 'demo-bank',
    ageBand: '18-24',
    event: 'inflation_published',
    shares: maria.spending.shares,
    monthly: maria.spending.monthly,
    grossMonthly: maria.grossMonthly,
    monthlyExpenses: maria.monthlyExpenses,
  });
  return c.json({ token, url: `/embed?token=${encodeURIComponent(token)}` } satisfies DemoTokenResponse);
});

/**
 * Partner view data, from a short-lived signed token.
 * The token carries only category shares, an age band and the event: no identity, no transactions. Nothing is stored.
 */
partner.get('/embed', async (c) => {
  const token = c.req.query('token');
  let claims: PartnerClaims | undefined;
  try {
    claims = token ? await verifyPartnerToken(token) : undefined;
  } catch {
    claims = undefined;
  }
  const p = claims && getPartner(claims.partnerId);
  if (!claims || !p) return c.json({ error: 'expired' }, 401);

  const monthly = { fuel: claims.monthly?.fuel ?? 0, utilities: claims.monthly?.utilities ?? 0, food: claims.monthly?.food ?? 0 };
  const inflation = inflationView({
    spending: { shares: claims.shares, monthly, source: 'bank' },
    grossMonthly: claims.grossMonthly,
    monthlyExpenses: claims.monthlyExpenses,
  });
  const s = getScenario('fuel-shortage');
  return c.json({
    partner: publicPartner(p),
    inflation,
    scenario: s ? { ...s, monthlySpend: monthly[s.spendLine] } : undefined,
  } satisfies EmbedResponse);
});
