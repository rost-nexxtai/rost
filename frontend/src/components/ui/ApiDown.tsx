'use client';

import { useRouter } from 'next/navigation';

/** Calm notice when the backend can't be reached. Fixture-backed content keeps rendering around it. */
export function ApiDown({ what }: { what: string }) {
  const router = useRouter();
  return (
    <section className="card" role="status">
      <h3>Nu ne putem conecta acum</h3>
      <p className="small muted">{what}</p>
      <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => router.refresh()}>
        Încearcă din nou
      </button>
    </section>
  );
}
