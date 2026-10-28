'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { Slider } from '@/components/ui/Slider';
import type { PayslipBreakdown, SalaryChangeResponse } from '@/contract';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    changed: 'Mi s-a schimbat salariul',
    first: 'Adaugă salariul tău',
    gross: 'Salariul brut pe lună',
    exact: 'Suma exactă, în lei',
    preview: 'Cu noul salariu',
    previewFirst: 'Din salariul ăsta',
    net: 'Net, în mână',
    pension: 'La pensie',
    pillar2: 'Din care Pilon II',
    diff: (d: string, up: boolean) => (up ? `+${d} pe lună` : `−${d} pe lună`),
    same: 'La fel ca acum',
    save: 'Salvează',
    saving: 'Salvăm…',
    cancel: 'Renunță',
    range: 'Pune un salariu brut între 1.000 și 200.000 de lei.',
    failed: 'Nu am putut salva acum. Încearcă din nou peste puțin.',
    raised: 'Felicitări pentru mărire! Am refăcut „Salariul tău, pe înțeles” cu cifrele noi.',
    open: 'Vezi momentul',
    saved: 'Am salvat. Tot ce vezi în aplicație folosește de acum noul salariu.',
    note: 'Îl ții la zi când primești o mărire sau schimbi jobul. Nu îl arătăm nimănui.',
  },
  {
    changed: 'My salary changed',
    first: 'Add your salary',
    gross: 'Gross monthly salary',
    exact: 'The exact amount, in lei',
    preview: 'With the new salary',
    previewFirst: 'From this salary',
    net: 'Net, in your hand',
    pension: 'To your pension',
    pillar2: 'Of which Pillar II',
    diff: (d, up) => (up ? `+${d} a month` : `−${d} a month`),
    same: 'Same as now',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    range: 'Enter a gross salary between 1,000 and 200,000 lei.',
    failed: "We couldn't save it right now. Try again in a moment.",
    raised: 'Congratulations on the raise! We redid “Your payslip, explained” with the new numbers.',
    open: 'See the moment',
    saved: 'Saved. Everything in the app now uses your new salary.',
    note: 'Keep it up to date when you get a raise or change jobs. We never show it to anyone.',
  },
);

const MIN = 1_000;
const MAX = 200_000;

/** Where a salary goes, fetched from the backend's rules while the user picks a number. */
function usePayslip(gross: number) {
  const [p, setP] = useState<PayslipBreakdown>();
  useEffect(() => {
    if (!(gross >= MIN && gross <= MAX)) return setP(undefined);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/payslip?gross=${gross}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : undefined))
        .then(setP)
        .catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [gross]);
  return p;
}

/**
 * "My salary changed": a slider plus the exact amount, a live preview of the new take-home pay
 * next to the current one, then save. A raise reopens the payslip moment with the new numbers.
 */
export function SalaryEditor({ current, now }: { current?: number; now?: PayslipBreakdown }) {
  const router = useRouter();
  const { lang, f } = useLang();
  const t = T[lang];
  const panel = useId();
  const [open, setOpen] = useState(!current);
  const [gross, setGross] = useState(current ?? 6000);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ text: string; runId?: string }>();
  const [error, setError] = useState('');
  const next = usePayslip(open ? gross : NaN);
  const valid = gross >= MIN && gross <= MAX;
  const changed = gross !== current;

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/me/salary', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grossMonthly: gross }) });
      if (!res.ok) throw new Error(res.statusText);
      const out = (await res.json()) as SalaryChangeResponse;
      const run = out.runs[0];
      setDone(out.raise && run ? { text: t.raised, runId: run.id } : { text: t.saved });
      setOpen(false);
      router.refresh();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  const delta = (key: 'net' | 'pension' | 'pillar2') => {
    if (!next || !now) return null;
    const d = next[key] - now[key];
    return d === 0 ? <span className="muted">{t.same}</span> : <span className={d > 0 ? 'delta-up' : 'delta-down'}>{t.diff(f.lei(Math.abs(d)), d > 0)}</span>;
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {done && (
        <div className="card card-tint rise" role="status">
          <p style={{ margin: 0 }}>{done.text}</p>
          {done.runId && (
            <Link href={`/moment/${done.runId}`} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
              {t.open}
            </Link>
          )}
        </div>
      )}
      {!open ? (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          aria-expanded={false}
          aria-controls={panel}
          onClick={() => {
            setOpen(true);
            setDone(undefined);
          }}
        >
          {current ? t.changed : t.first}
        </button>
      ) : (
        <div id={panel} className="card stack" style={{ gap: 14 }}>
          <Slider label={t.gross} min={3000} max={30000} step={100} value={Math.min(30000, Math.max(3000, gross))} onChange={setGross} format={() => f.lei(gross)} />
          <label className="stack" style={{ gap: 6 }}>
            <span className="small muted">{t.exact}</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={MIN}
              max={MAX}
              step={1}
              value={Number.isFinite(gross) ? gross : ''}
              onChange={(e) => setGross(e.target.value === '' ? NaN : Math.round(Number(e.target.value)))}
              aria-invalid={!valid || undefined}
            />
          </label>
          {!valid && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{t.range}</p>}
          {valid && next && (
            <div className="stack" style={{ gap: 8 }} aria-live="polite">
              <span className="eyebrow">{current === undefined ? t.previewFirst : t.preview}</span>
              {(['net', 'pension', 'pillar2'] as const).map((key) => (
                <div key={key} className="row">
                  <span>{t[key]}</span>
                  <span className="stack" style={{ gap: 0, alignItems: 'flex-end' }}>
                    <strong>{f.lei(next[key])}</strong>
                    {current !== undefined && changed && <span className="small">{delta(key)}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {error && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={!valid || !changed || busy} onClick={save}>
              {busy ? t.saving : t.save}
            </button>
            {current !== undefined && (
              <button type="button" className="btn-text" onClick={() => (setOpen(false), setGross(current))}>
                {t.cancel}
              </button>
            )}
          </div>
          <p className="note" style={{ margin: 0 }}>{t.note}</p>
        </div>
      )}
    </div>
  );
}
