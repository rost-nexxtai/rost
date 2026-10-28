import 'server-only';
import { JsonStore } from './json-store';
import { PgStore } from './pg-store';
import type { Store } from './types';

export type * from './types';

const g = globalThis as unknown as { __rostStore?: Store };

/**
 * DATA_MODE=demo (default): in-memory, seeded, offline.
 * DATA_MODE=db: Postgres at DATABASE_URL (run `npm run db:migrate` first).
 */
export async function getStore(): Promise<Store> {
  if (g.__rostStore) return g.__rostStore;
  if (process.env.DATA_MODE === 'db') {
    if (!process.env.DATABASE_URL) throw new Error('DATA_MODE=db needs DATABASE_URL');
    const { Pool } = await import('pg');
    g.__rostStore = new PgStore(new Pool({ connectionString: process.env.DATABASE_URL }));
  } else {
    g.__rostStore = JsonStore.seeded();
  }
  return g.__rostStore;
}

/** Demo mode only: throw away everything and start again from the seed. */
export function resetDemoStore(): boolean {
  if (process.env.DATA_MODE === 'db') return false;
  g.__rostStore = JsonStore.seeded();
  return true;
}
