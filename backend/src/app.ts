import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { metrics } from './routes/metrics';
import { moments } from './routes/moments';
import { options } from './routes/options';
import { partner } from './routes/partner';
import { payslipReader } from './routes/payslip';
import { referrals } from './routes/referrals';
import { triggers } from './routes/triggers';
import { users } from './routes/users';

/**
 * The Rost API. Every route lives under /api; the request and response shapes are in contract.ts.
 * The frontend proxies /api/* here, so the session cookie stays first-party.
 */
export const app = new Hono().basePath('/api');

if (process.env.NODE_ENV !== 'test') app.use(logger());

app.get('/health', (c) => c.json({ ok: true, mode: process.env.DATA_MODE === 'db' ? 'db' : 'demo' }));

app.route('/', users);
app.route('/', triggers);
app.route('/', moments);
app.route('/', options);
app.route('/', referrals);
app.route('/', partner);
app.route('/', metrics);
app.route('/', payslipReader);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal error' }, 500);
});
