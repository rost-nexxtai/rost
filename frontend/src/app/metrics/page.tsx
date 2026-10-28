import { Nav, TopBar } from '@/components/Nav';
import { lei } from '@/lib/format';
import type { MetricsResponse } from '@backend/contract';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** What we'd show a partner bank: aggregates only, counted live from this instance. */
export default async function MetricsPage() {
  const m = await api<MetricsResponse>('/api/metrics');
  const title = (id: string) => m.momentTitles[id] ?? id;

  return (
    <main className="shell">
      <TopBar />
      <h1>Metrics</h1>
      <p className="muted small">
        Counted live from this instance ({m.mode} mode). Aggregates only, no per-user data. These are not market figures.
      </p>

      <section className="card card-dark">
        <span className="eyebrow">North star</span>
        <div className="big">{Math.round(m.actionRate * 100)}%</div>
        <p className="muted">of completed moments led to an action the user confirmed a week later.</p>
      </section>

      <section className="card">
        <h2>Moments</h2>
        {Object.keys(m.moments).length === 0 && <p className="small muted">None opened yet.</p>}
        {Object.entries(m.moments).map(([id, v]) => (
          <div key={id} className="row">
            <span>{title(id)}</span>
            <span className="small">
              {v.completed} of {v.opened} completed
            </span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Actions</h2>
        <div className="grid3">
          <Stat label="Set" value={m.actions.set} />
          <Stat label="Confirmed" value={m.actions.confirmed} />
          <Stat label="Skipped" value={m.actions.skipped} />
        </div>
      </section>

      {m.payslipGuess && (
        <section className="card">
          <h2>Payslip guesses</h2>
          <p className="small">
            Average guess for the pension contribution: <strong>{lei(m.payslipGuess.avgGuess)}</strong>. Actual on average:{' '}
            <strong>{lei(m.payslipGuess.avgActual)}</strong>. {Math.round(m.payslipGuess.underGuessedShare * 100)}% guessed too low (
            {m.payslipGuess.count} {m.payslipGuess.count === 1 ? 'guess' : 'guesses'}).
          </p>
        </section>
      )}

      <section className="card">
        <h2>Referrals</h2>
        <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <Stat label="Clicked" value={m.referrals.clicked} />
          <Stat label="Opened" value={m.referrals.opened} />
          <Stat label="Funded" value={m.referrals.funded} />
          <Stat label="Fees" value={lei(m.referrals.feesLei)} />
        </div>
        <p className="note">Fees are earned only on funded accounts with partners. Example fees in the demo.</p>
      </section>
      <Nav current="/metrics" />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <strong className="h2">{value}</strong>
      <span className="small muted">{label}</span>
    </div>
  );
}
