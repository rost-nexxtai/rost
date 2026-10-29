'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const EVENT_TYPES = ['salary_received', 'payslip_uploaded', 'inflation_published', 'raise'] as const;
const SCENARIO_IDS = ['fuel-shortage', 'energy-spike', 'food-drought'] as const;

const T = copy(
  {
    events: {
      salary_received: { label: 'A intrat salariul', hint: 'ce ar trimite banca printr-un webhook' },
      payslip_uploaded: { label: 'Poză cu salariul încărcată', hint: 'poza documentului de salariu, de la utilizator' },
      inflation_published: { label: 'INS publică inflația', hint: 'lunar, în jur de 13' },
      raise: { label: 'Mărire de salariu', hint: 'repetă momentul „Salariul tău”' },
    } as Record<(typeof EVENT_TYPES)[number], { label: string; hint: string }>,
    scenarios: { 'fuel-shortage': 'Criză de carburant', 'energy-spike': 'Scumpirea energiei', 'food-drought': 'Secetă, prețuri la mâncare' } as Record<
      (typeof SCENARIO_IDS)[number],
      string
    >,
    opened: (ids: string) => `a deschis ${ids}`,
    nothing: 'nu s-a deschis nimic',
    skipped: (list: string) => ` · sărite: ${list}`,
    calendarEmpty: (day: string) => `calendar ${day}: nimic programat azi`,
    clock: (day: string, offset: number) => `ceas: ${day} (decalaj ${offset} zile)`,
    partnerView: 'vedere partener',
    resetDone: 'resetat: Maria de la zero, ceasul pe azi',
    title: 'Simulator (demo)',
    sub: 'Pentru demo și teste. În producție, evenimentele vin de la bănci, din calendar și de la redacție.',
    clockTitle: 'Ceas',
    plusDays: (n: number) => `+${n} zile`,
    today: 'Azi',
    runCalendar: 'Rulează calendarul de azi',
    calendarNote: 'Ziua salariului, termenul pentru Pilonul II (din data angajării) și data publicării INS sunt calculate, nu apăsate.',
    eventsTitle: 'Evenimente',
    ignoreCap: 'Ignoră limita de un moment pe săptămână (doar pe scenă)',
    scenario: 'Scenariu',
    publish: 'Publică scenariul',
    openNew: 'Deschide momentul nou',
    bankTitle: 'În aplicația băncii',
    bankSub: 'Același moment în aplicația unei bănci, dintr-un token semnat fără nume, cont sau tranzacții: ponderile cheltuielilor, o grupă de vârstă și sumele de care are nevoie lecția.',
    openAs: 'Deschide ca [PARTNER BANK]',
    referralTitle: 'Recomandare și comision',
    referralSub: 'Modelul de business, cu o bancă fictivă: click, cont deschis, cont alimentat, comision. Băncile reale din aplicație nu sunt parteneri și nu apar aici.',
    referralOpen: 'Deschide un depozit la [PARTNER BANK]',
    log: 'Jurnal',
    reset: 'Resetează demo-ul',
    nothingYet: 'Nimic încă.',
  },
  {
    events: {
      salary_received: { label: 'Salary arrived', hint: 'what a bank would send through a webhook' },
      payslip_uploaded: { label: 'Payslip uploaded', hint: 'a photo of the payslip, from the user' },
      inflation_published: { label: 'INS publishes inflation', hint: 'monthly, around the 13th' },
      raise: { label: 'Pay rise', hint: 'repeats the payslip moment' },
    },
    scenarios: { 'fuel-shortage': 'Fuel shortage', 'energy-spike': 'Energy price jump', 'food-drought': 'Drought, food prices' },
    opened: (ids) => `opened ${ids}`,
    nothing: 'nothing opened',
    skipped: (list) => ` · skipped ${list}`,
    calendarEmpty: (day) => `calendar ${day}: nothing scheduled today`,
    clock: (day, offset) => `clock: ${day} (offset ${offset} days)`,
    partnerView: 'partner view',
    resetDone: 'reset: Maria from scratch, clock back to today',
    title: 'Simulator (demo)',
    sub: 'For demos and tests. In production, events come from banks, the calendar and the news desk.',
    clockTitle: 'Clock',
    plusDays: (n) => `+${n} days`,
    today: 'Today',
    runCalendar: "Run today's calendar",
    calendarNote: 'Payday, the Pillar II deadline (from the hire date) and the INS release date are computed, not pressed.',
    eventsTitle: 'Events',
    ignoreCap: 'Ignore the one-moment-a-week limit (stage only)',
    scenario: 'Scenario',
    publish: 'Publish the scenario',
    openNew: 'Open the new moment',
    bankTitle: "In the bank's app",
    bankSub: "The same moment inside a bank's app, from a signed token with no name, account or transactions: spending shares, an age band and the amounts the lesson needs.",
    openAs: 'Open as [PARTNER BANK]',
    referralTitle: 'Referral and fee',
    referralSub: "The business model, with a fictional bank: click, account opened, account funded, fee. The real banks in the app aren't partners and don't appear here.",
    referralOpen: 'Open a deposit at [PARTNER BANK]',
    log: 'Log',
    reset: 'Reset the demo',
    nothingYet: 'Nothing yet.',
  },
);

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
  const t = T[useLang().lang];
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
      `${label}: ${opened.length ? t.opened(opened.join(', ')) : t.nothing}${
        skipped.length ? t.skipped(skipped.map((s) => `${s.momentId} (${s.reason})`).join(', ')) : ''
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
    if (!out.results.length) say(t.calendarEmpty(out.today));
    for (const r of out.results) report(`calendar ${out.today} → ${r.event.type}`, r);
  }

  async function moveClock(days: number) {
    const out = await call('/api/clock', { method: 'POST', body: JSON.stringify({ days }) });
    if (out.error) return say(`clock: ${out.error}`);
    setNow(out);
    say(t.clock(out.now.slice(0, 10), out.offsetDays));
  }

  async function openPartnerView() {
    const out = await call('/api/partner/demo-token');
    if (out.error) return say(`${t.partnerView}: ${out.error}`);
    window.open(out.url, '_blank');
  }

  async function reset() {
    const out = await call('/api/demo/reset', { method: 'POST' });
    if (out.error) return say(`reset: ${out.error}`);
    await call('/api/users', { method: 'POST', body: JSON.stringify({ demo: 'maria' }) });
    setLog([t.resetDone]);
    setLastRun(undefined);
    refreshClock();
    router.refresh();
  }

  return (
    <main className="shell">
      <TopBar />
      <h1>{t.title}</h1>
      <p className="muted small">{t.sub}</p>

      <section className="card">
        <div className="row">
          <h2>{t.clockTitle}</h2>
          <span className="small muted">{now ? now.now.slice(0, 10) : '…'}</span>
        </div>
        <div className="grid3">
          <button className="chip" onClick={() => moveClock((now?.offsetDays ?? 0) + 7)}>
            {t.plusDays(7)}
          </button>
          <button className="chip" onClick={() => moveClock((now?.offsetDays ?? 0) + 30)}>
            {t.plusDays(30)}
          </button>
          <button className="chip" onClick={() => moveClock(0)}>
            {t.today}
          </button>
        </div>
        <button className="btn btn-primary" onClick={runCalendar}>
          {t.runCalendar}
        </button>
        <p className="note">{t.calendarNote}</p>
      </section>

      <section className="card">
        <h2>{t.eventsTitle}</h2>
        <label className="check">
          <input type="checkbox" checked={ignoreCap} onChange={(e) => setIgnoreCap(e.target.checked)} /> {t.ignoreCap}
        </label>
        {EVENT_TYPES.map((type) => ({ type, ...t.events[type] })).map((e) => (
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
            aria-label={t.scenario}
            style={{ flex: 1 }}
          >
            {SCENARIO_IDS.map((id) => (
              <option key={id} value={id}>
                {t.scenarios[id]}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => fire('shock_scenario', { scenarioId })}>
            {t.publish}
          </button>
        </div>
        {lastRun && (
          <Link href={`/moment/${lastRun}`} className="btn btn-primary">
            {t.openNew}
          </Link>
        )}
      </section>

      <section className="card card-dark">
        <h2>{t.bankTitle}</h2>
        <p className="muted small">{t.bankSub}</p>
        <button className="btn btn-light" onClick={openPartnerView}>
          {t.openAs}
        </button>
      </section>

      <section className="card">
        <h2>{t.referralTitle}</h2>
        <p className="muted small">{t.referralSub}</p>
        {/* the same referral route a partner's offer would use; demo-bank-12m is never listed with real offers */}
        <a href="/r/demo-bank-12m" className="btn btn-secondary">
          {t.referralOpen}
        </a>
      </section>

      <section className="card">
        <div className="row">
          <h2>{t.log}</h2>
          <button className="btn btn-ghost" style={{ minHeight: 36 }} onClick={reset}>
            {t.reset}
          </button>
        </div>
        {log.length === 0 ? (
          <p className="small muted">{t.nothingYet}</p>
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
