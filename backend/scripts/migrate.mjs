// Working mode setup: applies db/migrations/*.sql in order, then seeds the demo persona.
// Usage: DATABASE_URL=postgres://rost:rost@localhost:5432/rost npm run db:migrate
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Same env files Next.js reads. Existing environment variables win.
for (const f of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(join(root, f));
  } catch {}
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local, or export it.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(join(root, 'db/migrations'))).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(root, 'db/migrations', file), 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`applied ${file}`);
  }

  // Seed the synthetic demo persona(s). Safe to re-run: existing rows are left alone.
  const { users } = JSON.parse(await readFile(join(root, 'data/seed/demo-users.json'), 'utf8'));
  for (const u of users) {
    const res = await client.query(
      `INSERT INTO users (id, name, situations, payday, hire_date, gross_monthly, last_raise_date, monthly_expenses, firsts_done, spending, created_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        u.id, u.name ?? null, JSON.stringify(u.situations), u.payday ?? null, u.hireDate ?? null, u.grossMonthly ?? null,
        u.lastRaiseDate ?? null, u.monthlyExpenses ?? null, JSON.stringify(u.firstsDone ?? []),
        u.spending ? JSON.stringify(u.spending) : null, new Date().toISOString(),
      ],
    );
    console.log(res.rowCount ? `seeded demo user ${u.id}` : `demo user ${u.id} already there`);
  }
  console.log('done');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  await client.end();
}
