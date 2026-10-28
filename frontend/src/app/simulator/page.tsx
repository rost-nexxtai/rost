'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';

const EVENTS = [
  { type: 'salary_received', label: 'A intrat salariul', hint: 'ce ar trimite banca printr-un webhook' },
  { type: 'payslip_uploaded', label: 'Fluturaș încărcat', hint: 'poză cu fluturașul, de la utilizator' },
  { type: 'inflation_published', label: 'INS publică inflația', hint: 'lunar, în jur de 13' },
  { type: 'raise', label: 'Mărire de salariu', hint: 'repetă momentul fluturașului' },
] as const;

const SCENARIOS = [
  { id: 'fuel-shortage', label: 'Criză de carburant' },
  { id: 'energy-spike', label: 'Scumpirea energiei' },
  { id: 'food-drought', label: 'Secetă, prețuri la mâncare' },
];

interface Outcome {
  runs?: { id: string; momentId: string }[];
  decision?: { open: string[]; skipped: { momentId: string; reason: string }[] };
  error?: string;
}

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init });
  return res.json();
}

/**
 * Stage control panel. Fires the same events a bank, the calendar or the news desk would.
 * Every trigger still goes through the engine, so the weekly cap and conditions apply.
 */
export default function Simulator() {
  const router = useRouter();
  const [now, setNow] = useState<{ offsetDays: number; now: string }>();
  const [log, setLog] = useState<string[]>([]);
  const [ignoreCap, setIgnoreCap] = useState(true);
  const [scenarioId, setScenarioId] = useState('fuel-shortage');
  const [lastRun, setLastRun] = useState<string>();

  const say = (line: string) => setLog((l) => [line, ...l].slice(0, 12));
  const refreshClock = () => call('/api/clock').then(setNow);
  useEffect(() => {
    refreshClock();
  }, []);

  function report(label: string, out: Outcome) {
    if (out.error) return say(`${label}: ${out.error}`);
    const opened = out.decision?.open ?? [];
    const skipped = (out.decision?.skipped ?? []).filter((s) => s.reason !== 'not_triggered');
    say(
      `${label}: ${opened.length ? `opened ${opened.join(', ')}` : 'nothing opened'}${
        skipped.length ? ` · skipped ${skipped.map((s) => `${s.momentId} (${s.reason})`).join(', ')}` : ''
      }`,
    );
    if (out.runs?.[0]) setLastRun(out.runs[0].id);
  }

  async function fire(type: string, payload?: Record<string, unknown>) {
    const out = await call('/api/events', { method: 'POST', body: JSON.stringify({ type, payload, ignoreWeeklyCap: ignoreCap }) });
    report(type, out);
    router.refresh();
  }

  async function runCalendar() {
    const out = await call('/api/calendar', { method: 'POST' });
    if (out.error) return say(`calendar: ${out.error}`);
    if (!out.results.length) say(`calendar ${out.today}: nimic programat azi`);
    for (const r of out.results) report(`calendar ${out.today} → ${r.event.type}`, r);
  }

  async function moveClock(days: number) {
    const out = await call('/api/clock', { method: 'POST', body: JSON.stringify({ days }) });
    if (out.error) return say(`clock: ${out.error}`);
    setNow(out);
    say(`clock: ${out.now.slice(0, 10)} (decalaj ${out.offsetDays} zile)`);
  }

  async function openPartnerView() {
    const out = await call('/api/partner/demo-token');
    if (out.error) return say(`partner view: ${out.error}`);
    window.open(out.url, '_blank');
  }

  async function reset() {
    const out = await call('/api/demo/reset', { method: 'POST' });
    if (out.error) return say(`reset: ${out.error}`);
    await call('/api/users', { method: 'POST', body: JSON.stringify({ demo: 'maria' }) });
    setLog(['resetat: Maria de la zero, ceasul pe azi']);
    setLastRun(undefined);
    refreshClock();
    router.refresh();
  }

  return (
    <main className="shell">
      <TopBar />
      <h1>Simulator (demo)</h1>
      <p className="muted small">Pentru demo și teste. În producție, evenimentele vin de la bănci, din calendar și de la redacție.</p>

      <section className="card">
        <div className="row">
          <h2>Ceas</h2>
          <span className="small muted">{now ? now.now.slice(0, 10) : '…'}</span>
        </div>
        <div className="grid3">
          <button className="chip" onClick={() => moveClock((now?.offsetDays ?? 0) + 7)}>
            +7 zile
          </button>
          <button className="chip" onClick={() => moveClock((now?.offsetDays ?? 0) + 30)}>
            +30 zile
          </button>
          <button className="chip" onClick={() => moveClock(0)}>
            Azi
          </button>
        </div>
        <button className="btn btn-primary" onClick={runCalendar}>
          Rulează calendarul de azi
        </button>
        <p className="note">Ziua salariului, termenul pentru Pilonul II (din data angajării) și data publicării INS sunt calculate, nu apăsate.</p>
      </section>

      <section className="card">
        <h2>Evenimente</h2>
        <label className="check">
          <input type="checkbox" checked={ignoreCap} onChange={(e) => setIgnoreCap(e.target.checked)} /> Ignoră limita de un moment pe săptămână (doar pe scenă)
        </label>
        {EVENTS.map((e) => (
          <button
            key={e.type}
            className="btn btn-ghost"
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0, padding: '8px 18px', borderRadius: 16 }}
            onClick={() => fire(e.type)}
          >
            {e.label}
            <span className="small muted" style={{ fontWeight: 400 }}>
              {e.hint}
            </span>
          </button>
        ))}
        <div className="row">
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            aria-label="Scenariu"
            style={{ flex: 1 }}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => fire('shock_scenario', { scenarioId })}>
            Publică scenariul
          </button>
        </div>
        {lastRun && (
          <Link href={`/moment/${lastRun}`} className="btn btn-primary">
            Deschide momentul nou
          </Link>
        )}
      </section>

      <section className="card card-dark">
        <h2>În aplicația băncii</h2>
        <p className="muted small">Același moment în aplicația unei bănci, dintr-un token semnat care conține doar ponderile cheltuielilor.</p>
        <button className="btn btn-light" onClick={openPartnerView}>
          Deschide ca [PARTNER BANK]
        </button>
      </section>

      <section className="card">
        <div className="row">
          <h2>Jurnal</h2>
          <button className="btn btn-ghost" style={{ minHeight: 36 }} onClick={reset}>
            Resetează demo-ul
          </button>
        </div>
        {log.length === 0 ? (
          <p className="small muted">Nimic încă.</p>
        ) : (
          log.map((l, i) => (
            <p key={i} className="small" style={{ fontFamily: 'ui-monospace, monospace' }}>
              {l}
            </p>
          ))
        )}
      </section>
      <TabBar />
    </main>
  );
}
