import Link from 'next/link';
import type { InflationView } from '@backend/contract';
import { lei, pct } from '@/lib/format';
import { ScenarioSlider, type ScenarioSliderProps } from './ScenarioSlider';

const GROUPS = [
  { key: 'services', label: 'Services', hint: 'rent, transport, phone' },
  { key: 'nonFood', label: 'Shopping and fuel', hint: 'non-food goods' },
  { key: 'food', label: 'Groceries', hint: 'food goods' },
] as const;

/**
 * Personal inflation: your spending mix x the official INS group rates.
 * Used in the app and, with a partner theme, inside a bank's app (/embed).
 */
export function InflationReveal({
  iv,
  guess,
  scenario,
  showOptionsLink = true,
}: {
  iv: InflationView;
  guess?: number;
  scenario?: ScenarioSliderProps;
  showOptionsLink?: boolean;
}) {
  const personal = iv.personal.personalPct;
  const diff = Math.round((personal - iv.headlinePct) * 100) / 100;
  const maxContribution = Math.max(...GROUPS.map((g) => iv.personal.contributions[g.key]), 0.01);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card card-dark">
        <span className="eyebrow">Your inflation · {iv.period}</span>
        <div className="big">{pct(personal, 2)}</div>
        <p className="muted">
          National: {pct(iv.headlinePct, 2)}. Yours is {Math.abs(diff).toFixed(2)} points {diff >= 0 ? 'higher' : 'lower'}
          {guess !== undefined ? `. You guessed ${pct(guess)}.` : '.'}
        </p>
      </div>

      <div className="card">
        <h2>Why</h2>
        {GROUPS.map((g) => (
          <div key={g.key} className="stack" style={{ gap: 4 }}>
            <div className="row">
              <span>
                {g.label} <span className="small muted">· {Math.round(iv.personal.shares[g.key] * 100)}% of your spending</span>
              </span>
              <strong>+{iv.personal.contributions[g.key].toFixed(2)} pts</strong>
            </div>
            <div className="bar">
              <div
                style={{
                  width: `${(iv.personal.contributions[g.key] / maxContribution) * 100}%`,
                  background: g.key === 'services' ? 'var(--accent)' : 'var(--grey-bar)',
                }}
              />
            </div>
            <span className="small muted">
              {g.hint}: prices up {pct(iv.groupsPct[g.key], 2)} in a year
            </span>
          </div>
        ))}
      </div>

      {iv.realSalary && (
        <div className="card">
          <span className="eyebrow">Your salary, in today&apos;s money</span>
          <p>
            {lei(iv.realSalary.gross)} gross today buys what <strong>{lei(iv.realSalary.nowWorth)}</strong> bought a year ago.
            {iv.realSalary.since ? ` Your pay hasn't changed since ${iv.realSalary.since}.` : ''} A raise below{' '}
            {pct(iv.personal.personalPct, 1)} is a pay cut in what it buys.
          </p>
        </div>
      )}

      <div className="card">
        <span className="eyebrow">{lei(iv.savings.amountLei)} saved for a year, against your inflation</span>
        {iv.savings.rows.map((r) => (
          <div key={r.label} className="row">
            <span>
              {r.label} <span className="small muted">· {pct(r.netRatePct, 2)} after tax</span>
            </span>
            <strong style={{ color: r.realChangeLei < 0 ? 'var(--accent-ink)' : 'var(--ink)' }}>
              {r.realChangeLei >= 0 ? '+' : '−'}
              {lei(Math.abs(r.realChangeLei))}
            </strong>
          </div>
        ))}
        {iv.savings.exampleRates && <p className="note">Example rates for the demo. Live rates come from each provider.</p>}
        {showOptionsLink && (
          <Link href="/options" className="btn btn-ghost">
            See the ranked options
          </Link>
        )}
      </div>

      {scenario && <ScenarioSlider {...scenario} />}

      <p className="note">
        Source: <a href={iv.source.url}>{iv.source.label}</a>. Your mix × official group rates. Education, not advice.
      </p>
    </div>
  );
}
