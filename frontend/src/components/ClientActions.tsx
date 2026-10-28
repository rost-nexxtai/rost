'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { resetProfile, setDemoProfile } from '@/data/actions';

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

/** "Continuă ca Maria" for the stage demo: a real backend session plus Maria's (mock) profile. */
export function DemoLogin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="btn btn-secondary btn-block"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await post('/api/users', { demo: 'maria' });
            await setDemoProfile('maria');
            router.push('/acasa');
          } catch (e) {
            setError(String((e as Error).message));
            setBusy(false);
          }
        }}
      >
        Continuă ca Maria (demo)
      </button>
      {error && <p className="error">Nu am putut porni demo-ul: {error}</p>}
    </>
  );
}

/** Profil → Resetează: forgets the mock profile and the session, back to the landing page. */
export function ResetButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost btn-block"
      onClick={async () => {
        await resetProfile();
        await fetch('/api/users', { method: 'DELETE' }).catch(() => undefined);
        router.push('/');
        router.refresh();
      }}
    >
      Resetează
    </button>
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
