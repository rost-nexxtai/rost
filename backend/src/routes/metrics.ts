import { Hono } from 'hono';
import type { MetricsResponse } from '../contract';
import { computeMetrics } from '../lib/metrics';
import { momentDefs } from '../lib/reference';
import { getStore } from '../lib/store';

export const metrics = new Hono();

/** What we'd show a partner bank: aggregates only, counted live from this instance. */
metrics.get('/metrics', async (c) => {
  const store = await getStore();
  return c.json({
    ...(await computeMetrics(store)),
    mode: store.mode,
    momentTitles: Object.fromEntries(momentDefs().map((d) => [d.id, d.title])),
  } satisfies MetricsResponse);
});
