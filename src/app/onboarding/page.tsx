'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const SITUATIONS = [
  ['student', 'Studying'],
  ['graduate', 'Just graduated'],
  ['employed', 'Employed'],
  ['freelance', 'Freelance (PFA)'],
  ['between_jobs', 'Between jobs'],
] as const;

const FIRSTS = [
  ['payslip', 'Got a payslip'],
  ['savings', 'Saved money'],
  ['investing', 'Opened an investing app'],
  ['freelance', 'Freelanced'],
  ['tax_return', 'Filed a tax return'],
] as const;

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function Onboarding() {
  const router = useRouter();
  const [situations, setSituations] = useState<string[]>([]);
  const [firsts, setFirsts] = useState<string[]>([]);
  const [payday, setPayday] = useState('10');
  const [hireDate, setHireDate] = useState('');
  const [gross, setGross] = useState('');
  const [services, setServices] = useState('1400');
  const [nonFood, setNonFood] = useState('600');
  const [food, setFood] = useState('500');
  const [fuel, setFuel] = useState('300');
  const [utilities, setUtilities] = useState('300');
  const [error, setError] = useState('');
  const employed = situations.includes('employed');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const s = Number(services), n = Number(nonFood), f = Number(food);
    const total = s + n + f;
    const body = {
      situations,
      firstsDone: firsts,
      payday: employed ? Number(payday) : undefined,
      hireDate: employed && hireDate ? hireDate : undefined,
      grossMonthly: gross ? Number(gross) : undefined,
      monthlyExpenses: total || undefined,
      spending: total
        ? {
            shares: { services: s / total, nonFood: n / total, food: f / total },
            monthly: { fuel: Number(fuel) || 0, utilities: Number(utilities) || 0, food: f },
            source: 'self',
          }
        : undefined,
    };
    const res = await fetch('/api/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return setError((await res.json()).error ?? 'Something went wrong');
    router.push('/today');
  }

  return (
    <main className="shell">
      <div className="wordmark">
        rost<span>.</span>
      </div>
      <h1>Three questions, under a minute</h1>
      <form onSubmit={submit} className="stack">
        <fieldset className="card">
          <legend>1. What&apos;s your money situation right now?</legend>
          {SITUATIONS.map(([v, l]) => (
            <label key={v} className="check">
              <input type="checkbox" checked={situations.includes(v)} onChange={() => setSituations(toggle(situations, v))} /> {l}
            </label>
          ))}
        </fieldset>

        <fieldset className="card">
          <legend>2. Your pay (only what you want to share)</legend>
          <label>
            Gross monthly salary, lei
            <input type="number" inputMode="numeric" min={0} value={gross} onChange={(e) => setGross(e.target.value)} placeholder="e.g. 6000" />
          </label>
          {employed && (
            <>
              <label>
                Payday (day of month)
                <input type="number" min={1} max={31} value={payday} onChange={(e) => setPayday(e.target.value)} />
              </label>
              <label>
                Hire date (sets your Pillar II deadline)
                <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
              </label>
            </>
          )}
        </fieldset>

        <fieldset className="card">
          <legend>3. Your money mix, lei a month (for your personal inflation)</legend>
          <label>
            Rent, phone, transport and other services
            <input type="number" min={0} value={services} onChange={(e) => setServices(e.target.value)} />
          </label>
          <label>
            Shopping and fuel
            <input type="number" min={0} value={nonFood} onChange={(e) => setNonFood(e.target.value)} />
          </label>
          <label>
            Groceries
            <input type="number" min={0} value={food} onChange={(e) => setFood(e.target.value)} />
          </label>
          <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>
              Of which fuel
              <input type="number" min={0} value={fuel} onChange={(e) => setFuel(e.target.value)} />
            </label>
            <label>
              Utilities
              <input type="number" min={0} value={utilities} onChange={(e) => setUtilities(e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Which of these have you already done?</legend>
          {FIRSTS.map(([v, l]) => (
            <label key={v} className="check">
              <input type="checkbox" checked={firsts.includes(v)} onChange={() => setFirsts(toggle(firsts, v))} /> {l}
            </label>
          ))}
          <p className="note">Anything you tick becomes a catch-up moment: your first one, explained.</p>
        </fieldset>

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={!situations.length}>
          Show me my moments
        </button>
      </form>
    </main>
  );
}
