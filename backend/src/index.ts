import { join } from 'node:path';
import { serve } from '@hono/node-server';

// Load backend/.env.local and backend/.env. Existing environment variables win.
for (const f of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(join(import.meta.dirname, '..', f));
  } catch {}
}

// Imported after the env files so the store sees DATA_MODE.
const { app } = await import('./app');

const port = Number(process.env.PORT) || 4000;
serve({ fetch: app.fetch, port }, () => {
  console.log(`rost api on http://localhost:${port}/api (${process.env.DATA_MODE === 'db' ? 'db' : 'demo'} mode)`);
});
