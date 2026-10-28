'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { resetProfile, setDemoProfile } from '@/data/actions';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    demo: 'Continuă ca Maria (demo)',
    start: 'Începe',
    demoFailed: (e: string) => `Nu am putut porni demo-ul: ${e}`,
    reset: 'Resetează',
    weekLater: 'O săptămână mai târziu',
    yes: 'Da, gata',
    notYet: 'Încă nu',
  },
  {
    demo: 'Continue as Maria (demo)',
    start: 'Start',
    demoFailed: (e) => `Couldn't start the demo: ${e}`,
    reset: 'Reset',
    weekLater: 'A week later',
    yes: 'Yes, done',
    notYet: 'Not yet',
  },
);

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

/** "Continuă ca Maria" for the stage demo: a real backend session plus Maria's (mock) profile. */
export function DemoLogin() {
  const router = useRouter();
  const t = T[useLang().lang];
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
        {t.demo}
      </button>
      {error && <p className="error">{t.demoFailed(error)}</p>}
    </>
  );
}

/** Profil → Resetează: forgets the mock profile and the session, back to the landing page. */
export function ResetButton() {
  const router = useRouter();
  const t = T[useLang().lang];
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
      {t.reset}
    </button>
  );
}

/** Opens a moment the user hasn't done yet (user-initiated, so no weekly cap). */
export function CatchUpButton({ momentId }: { momentId: string }) {
  const router = useRouter();
  const t = T[useLang().lang];
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-secondary btn-sm"
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
      {t.start}
    </button>
  );
}

/** The 7-day check: an action counts only once confirmed. */
export function FollowUp({ actionId, text }: { actionId: string; text: string }) {
  const router = useRouter();
  const t = T[useLang().lang];
  const answer = async (status: 'confirmed' | 'skipped') => {
    await post('/api/followups', { actionId, status });
    router.refresh();
  };
  return (
    <div className="card card-tint rise">
      <span className="eyebrow">{t.weekLater}</span>
      <p>{text}</p>
      <div className="row">
        <button className="btn btn-primary" onClick={() => answer('confirmed')}>
          {t.yes}
        </button>
        <button className="btn btn-ghost" onClick={() => answer('skipped')}>
          {t.notYet}
        </button>
      </div>
    </div>
  );
}
