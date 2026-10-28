'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

/** "Continue as Maria" for the stage demo. */
export function DemoLogin() {
  const router = useRouter();
  const [error, setError] = useState('');
  return (
    <>
      <button
        className="btn btn-light btn-block"
        onClick={async () => {
          try {
            await post('/api/users', { demo: 'maria' });
            router.push('/today');
          } catch (e) {
            setError(String((e as Error).message));
          }
        }}
      >
        Continue as Maria (demo)
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}

/** Opens a moment the user hasn't done yet (user-initiated, so no weekly cap). */
export function CatchUpButton({ momentId, label }: { momentId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const out = await post('/api/events', { type: 'catch_up', payload: { momentId } });
        const run = out.runs?.[0];
        if (run) router.push(`/moment/${run.id}`);
        else router.refresh();
        setBusy(false);
      }}
    >
      {label}
    </button>
  );
}

/** The 7-day check: an action counts only once confirmed. */
export function FollowUp({ actionId, text }: { actionId: string; text: string }) {
  const router = useRouter();
  const answer = async (status: 'confirmed' | 'skipped') => {
    await post('/api/followups', { actionId, status });
    router.refresh();
  };
  return (
    <div className="card card-tint">
      <span className="eyebrow">A week later</span>
      <p>{text}</p>
      <div className="row">
        <button className="btn btn-primary" onClick={() => answer('confirmed')}>
          Yes, done
        </button>
        <button className="btn btn-ghost" onClick={() => answer('skipped')}>
          Not yet
        </button>
      </div>
    </div>
  );
}
