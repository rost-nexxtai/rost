import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
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
      <h1>Metrici</h1>
      <p className="muted small">
        Numărate live din instanța asta (mod {m.mode}). Doar agregate, fără date per utilizator. Nu sunt cifre de piață.
      </p>

      <section className="card card-dark">
        <span className="eyebrow">Rata de acțiune</span>
        <div className="big">{Math.round(m.actionRate * 100)}%</div>
        <p className="muted">din momentele terminate au dus la un pas confirmat de utilizator o săptămână mai târziu.</p>
      </section>

      <section className="card">
        <h2>Momente</h2>
        {Object.keys(m.moments).length === 0 && <p className="small muted">Niciunul deschis încă.</p>}
        {Object.entries(m.moments).map(([id, v]) => (
          <div key={id} className="row">
            <span>{title(id)}</span>
            <span className="small">
              {v.completed} din {v.opened} terminate
            </span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Pași</h2>
        <div className="grid3">
          <Stat label="Setați" value={m.actions.set} />
          <Stat label="Confirmați" value={m.actions.confirmed} />
          <Stat label="Săriți" value={m.actions.skipped} />
        </div>
      </section>

      {m.payslipGuess && (
        <section className="card">
          <h2>Ce ghicesc oamenii la fluturaș</h2>
          <p className="small">
            Media răspunsurilor pentru contribuția la pensie: <strong>{lei(m.payslipGuess.avgGuess)}</strong>. Real, în medie:{' '}
            <strong>{lei(m.payslipGuess.avgActual)}</strong>. {Math.round(m.payslipGuess.underGuessedShare * 100)}% au ghicit prea puțin (
            {m.payslipGuess.count} {m.payslipGuess.count === 1 ? 'răspuns' : 'răspunsuri'}).
          </p>
        </section>
      )}

      <section className="card">
        <h2>Recomandări către bănci</h2>
        <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <Stat label="Click-uri" value={m.referrals.clicked} />
          <Stat label="Deschise" value={m.referrals.opened} />
          <Stat label="Alimentate" value={m.referrals.funded} />
          <Stat label="Comisioane" value={lei(m.referrals.feesLei)} />
        </div>
        <p className="note">Comisioanele vin doar din conturi alimentate la parteneri. În demo, comisioanele sunt exemple.</p>
      </section>
      <TabBar />
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
