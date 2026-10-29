'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Slider } from '@/components/ui/Slider';
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
    salary: 'Salariul brut pe lună',
    salaryNote: 'Nu ai încă salariu? Pune unul la care te aștepți. Îl folosim doar ca să-ți arătăm unde merg banii din el.',
    cancel: 'Renunță',
  },
  {
    demo: 'Continue as Maria (demo)',
    start: 'Start',
    demoFailed: (e) => `Couldn't start the demo: ${e}`,
    reset: 'Reset',
    weekLater: 'A week later',
    yes: 'Yes, done',
    notYet: 'Not yet',
    salary: 'Gross monthly salary',
    salaryNote: "No salary yet? Put in one you expect. We only use it to show you where the money goes.",
    cancel: 'Cancel',
  },
);

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

/** "Continuă ca Maria" for the stage demo: a backend session as Maria, with her profile. */
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

/** Profil → Resetează: erases the account and its data (a demo persona goes back to its seed), back to the landing page. */
export function ResetButton() {
  const router = useRouter();
  const t = T[useLang().lang];
  return (
    <button
      className="btn btn-ghost btn-block"
      onClick={async () => {
        await fetch('/api/me', { method: 'DELETE' }).catch(() => undefined);
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
  const t = T[useLang().lang];
  const { busy, start } = useCatchUp(momentId);
  return (
    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => start()}>
      {t.start}
    </button>
  );
}

function useCatchUp(momentId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const start = async (extra?: { grossMonthly: number }) => {
    setBusy(true);
    try {
      const out = await post('/api/events', { type: 'catch_up', payload: { momentId, ...extra } });
      const run = out.runs?.[0];
      if (run) router.push(`/moment/${run.id}`);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return { busy, start };
}

/** Start for a moment that needs a gross salary first (the payslip): one slider, then the moment. */
export function CatchUpWithSalary({ momentId, children }: { momentId: string; children: React.ReactNode }) {
  const { lang, f } = useLang();
  const t = T[lang];
  const { busy, start } = useCatchUp(momentId);
  const [asking, setAsking] = useState(false);
  const [gross, setGross] = useState(6000);
  const panel = useId();
  return (
    <div>
      <div className="list-row">
        {children}
        <button className="btn btn-secondary btn-sm" aria-expanded={asking} aria-controls={panel} onClick={() => setAsking((a) => !a)}>
          {asking ? t.cancel : t.start}
        </button>
      </div>
      {asking && (
        <div id={panel} className="stack" style={{ gap: 10, paddingBottom: 12 }}>
          <Slider label={t.salary} min={3000} max={30000} step={250} value={gross} onChange={setGross} format={f.lei} />
          <p className="note">{t.salaryNote}</p>
          <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => start({ grossMonthly: gross })}>
            {t.start}
          </button>
        </div>
      )}
    </div>
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
