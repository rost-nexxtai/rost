'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Nav, TopBar } from '@/components/Nav';

const EVENTS = [
  { type: 'salary_received', label: 'Salary received', hint: 'what a bank webhook would send' },
  { type: 'payslip_uploaded', label: 'Payslip uploaded', hint: 'user photo of a payslip' },
  { type: 'inflation_published', label: 'INS publishes inflation', hint: 'monthly, ~13th' },
  { type: 'raise', label: 'Got a raise', hint: 'repeats the payslip moment' },
] as const;

const SCENARIOS = [
  { id: 'fuel-shortage', label: 'Fuel shortage' },
  { id: 'energy-spike', label: 'Energy price spike' },
  { id: 'food-drought', label: 'Drought, food prices' },
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
    if (!out.results.length) say(`calendar ${out.today}: nothing due today`);
    for (const r of out.results) report(`calendar ${out.today} → ${r.event.type}`, r);
  }

  async function moveClock(days: number) {
    const out = await call('/api/clock', { method: 'POST', body: JSON.stringify({ days }) });
    if (out.error) return say(`clock: ${out.error}`);
    setNow(out);
    say(`clock: ${out.now.slice(0, 10)} (offset ${out.offsetDays} days)`);
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
    setLog(['reset: fresh Maria, clock back to today']);
    setLastRun(undefined);
    refreshClock();
    router.refresh();
  }

  return (
    <main className="shell">
      <TopBar />
      <h1>Simulator</h1>
      <p className="muted small">For the demo and for testing. In production these come from banks, the calendar and the news desk.</p>

      <section className="card">
        <div className="row">
          <h2>Clock</h2>
          <span className="small muted">{now ? now.now.slice(0, 10) : '…'}</span>
        </div>
        <div className="grid3">
          <button className="chip" onClick={() => moveClock((now?.offsetDays ?? 0) + 7)}>
            +7 days
          </button>
          <button className="chip" onClick={() => moveClock((now?.offsetDays ?? 0) + 30)}>
            +30 days
          </button>
          <button className="chip" onClick={() => moveClock(0)}>
            Today
          </button>
        </div>
        <button className="btn btn-primary" onClick={runCalendar}>
          Run today&apos;s calendar
        </button>
        <p className="note">Payday, the Pillar II deadline (from the hire date) and the INS release date are computed, not pressed.</p>
      </section>

      <section className="card">
        <h2>Events</h2>
        <label className="check">
          <input type="checkbox" checked={ignoreCap} onChange={(e) => setIgnoreCap(e.target.checked)} /> Ignore the 1-a-week cap (stage only)
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
            aria-label="Scenario"
            style={{ height: 46, borderRadius: 12, border: '1px solid #dcdfe5', padding: '0 10px', font: 'inherit', flex: 1 }}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => fire('shock_scenario', { scenarioId })}>
            Publish what-if
          </button>
        </div>
        {lastRun && (
          <Link href={`/moment/${lastRun}`} className="btn btn-primary">
            Open the new moment
          </Link>
        )}
      </section>

      <section className="card card-dark">
        <h2>Partner view</h2>
        <p className="muted small">The same moment inside a bank&apos;s app, from a signed token with spending shares only.</p>
        <button className="btn btn-light" onClick={openPartnerView}>
          Open as [PARTNER BANK]
        </button>
      </section>

      <section className="card">
        <div className="row">
          <h2>Log</h2>
          <button className="btn btn-ghost" style={{ minHeight: 36 }} onClick={reset}>
            Reset demo
          </button>
        </div>
        {log.length === 0 ? (
          <p className="small muted">Nothing yet.</p>
        ) : (
          log.map((l, i) => (
            <p key={i} className="small" style={{ fontFamily: 'ui-monospace, monospace' }}>
              {l}
            </p>
          ))
        )}
      </section>
      <Nav current="/simulator" />
    </main>
  );
}
