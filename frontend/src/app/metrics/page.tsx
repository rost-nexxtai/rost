import { ApiDown } from '@/components/ui/ApiDown';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { fmt } from '@/lib/format';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';
import type { MetricsResponse } from '@/contract';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

const T = copy(
  {
    title: 'Metrici',
    sub: (mode: string) => `Numărate live din instanța asta (mod ${mode}). Doar agregate, fără date per utilizator. Nu sunt cifre de piață.`,
    actionRate: 'Rata de acțiune',
    actionRateSub: 'din momentele terminate au dus la un pas confirmat de utilizator o săptămână mai târziu.',
    moments: 'Momente',
    noneYet: 'Niciunul deschis încă.',
    finished: (done: number, opened: number) => `${done} din ${opened} terminate`,
    steps: 'Pași',
    set: 'Setați',
    confirmed: 'Confirmați',
    skipped: 'Săriți',
    guessTitle: 'Ce ghicesc oamenii la fluturaș',
    guess: (avg: string, actual: string, under: number, count: number) => [
      'Media răspunsurilor pentru contribuția la pensie: ',
      avg,
      '. Real, în medie: ',
      actual,
      `. ${under}% au ghicit prea puțin (${count} ${count === 1 ? 'răspuns' : 'răspunsuri'}).`,
    ],
    referrals: 'Recomandări către bănci',
    clicks: 'Click-uri',
    opened: 'Deschise',
    funded: 'Alimentate',
    fees: 'Comisioane',
    feesNote: 'Comisioanele vin doar din conturi alimentate la parteneri. În demo, comisioanele sunt exemple.',
    down: 'Cifrele vin de la server. Revin când se reface conexiunea.',
  },
  {
    title: 'Metrics',
    sub: (mode) => `Counted live from this instance (${mode} mode). Aggregates only, no per-user data. Not market figures.`,
    actionRate: 'Action rate',
    actionRateSub: 'of finished moments led to a step the user confirmed a week later.',
    moments: 'Moments',
    noneYet: 'None opened yet.',
    finished: (done, opened) => `${done} of ${opened} finished`,
    steps: 'Steps',
    set: 'Set',
    confirmed: 'Confirmed',
    skipped: 'Skipped',
    guessTitle: 'What people guess on the payslip',
    guess: (avg, actual, under, count) => [
      'Average guess for the pension contribution: ',
      avg,
      '. Actual, on average: ',
      actual,
      `. ${under}% guessed too low (${count} ${count === 1 ? 'answer' : 'answers'}).`,
    ],
    referrals: 'Referrals to banks',
    clicks: 'Clicks',
    opened: 'Opened',
    funded: 'Funded',
    fees: 'Fees',
    feesNote: 'Fees come only from funded accounts at partners. In the demo, the fees are examples.',
    down: 'The numbers come from the server. They come back when the connection does.',
  },
);

/** What we'd show a partner bank: aggregates only, counted live from this instance. */
export default async function MetricsPage() {
  const [m, lang] = await Promise.all([api<MetricsResponse>('/api/metrics').catch(() => undefined), getLang()]);
  const t = T[lang];
  if (!m) {
    // Backend unreachable: say so calmly instead of an error page (the demo must survive bad wifi).
    return (
      <main className="shell">
        <TopBar />
        <h1>{t.title}</h1>
        <ApiDown what={t.down} />
        <TabBar />
      </main>
    );
  }
  const lei = fmt(lang).lei;
  const title = (id: string) => m.momentTitles[id] ?? id;

  return (
    <main className="shell">
      <TopBar />
      <h1>{t.title}</h1>
      <p className="muted small">{t.sub(m.mode)}</p>

      <section className="card card-dark">
        <span className="eyebrow">{t.actionRate}</span>
        <div className="big">{Math.round(m.actionRate * 100)}%</div>
        <p className="muted">{t.actionRateSub}</p>
      </section>

      <section className="card">
        <h2>{t.moments}</h2>
        {Object.keys(m.moments).length === 0 && <p className="small muted">{t.noneYet}</p>}
        {Object.entries(m.moments).map(([id, v]) => (
          <div key={id} className="row">
            <span>{title(id)}</span>
            <span className="small">{t.finished(v.completed, v.opened)}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>{t.steps}</h2>
        <div className="grid3">
          <Stat label={t.set} value={m.actions.set} />
          <Stat label={t.confirmed} value={m.actions.confirmed} />
          <Stat label={t.skipped} value={m.actions.skipped} />
        </div>
      </section>

      {m.payslipGuess && (
        <section className="card">
          <h2>{t.guessTitle}</h2>
          <p className="small">
            {(([a, avg, b, actual, c]) => (
              <>
                {a}
                <strong>{avg}</strong>
                {b}
                <strong>{actual}</strong>
                {c}
              </>
            ))(t.guess(lei(m.payslipGuess.avgGuess), lei(m.payslipGuess.avgActual), Math.round(m.payslipGuess.underGuessedShare * 100), m.payslipGuess.count))}
          </p>
        </section>
      )}

      <section className="card">
        <h2>{t.referrals}</h2>
        <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <Stat label={t.clicks} value={m.referrals.clicked} />
          <Stat label={t.opened} value={m.referrals.opened} />
          <Stat label={t.funded} value={m.referrals.funded} />
          <Stat label={t.fees} value={lei(m.referrals.feesLei)} />
        </div>
        <p className="note">{t.feesNote}</p>
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
