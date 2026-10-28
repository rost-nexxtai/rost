import Link from 'next/link';
import type { InflationView } from '@/contract';
import { lei, pct } from '@/lib/format';
import { ScenarioSlider, type ScenarioSliderProps } from './ScenarioSlider';

const GROUPS = [
  { key: 'services', label: 'Servicii', hint: 'chirie, transport, telefon' },
  { key: 'nonFood', label: 'Cumpărături și carburant', hint: 'mărfuri nealimentare' },
  { key: 'food', label: 'Mâncare', hint: 'mărfuri alimentare' },
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
        <span className="eyebrow">Inflația ta · {iv.period}</span>
        <div className="big">{pct(personal, 2)}</div>
        <p className="muted">
          La nivel național: {pct(iv.headlinePct, 2)}. A ta e cu {pct(Math.abs(diff), 2).replace('%', '')} puncte{' '}
          {diff >= 0 ? 'mai mare' : 'mai mică'}
          {guess !== undefined ? `. Tu ai zis ${pct(guess)}.` : '.'}
        </p>
      </div>

      <div className="card">
        <h2>De ce</h2>
        {GROUPS.map((g) => (
          <div key={g.key} className="stack" style={{ gap: 4 }}>
            <div className="row">
              <span>
                {g.label} <span className="small muted">· {Math.round(iv.personal.shares[g.key] * 100)}% din cheltuieli</span>
              </span>
              <strong>+{pct(iv.personal.contributions[g.key], 2).replace('%', '')} pct.</strong>
            </div>
            <div className="bar">
              <div
                style={{
                  width: `${(iv.personal.contributions[g.key] / maxContribution) * 100}%`,
                  background: g.key === 'services' ? 'var(--accent)' : 'var(--muted)',
                }}
              />
            </div>
            <span className="small muted">
              {g.hint}: prețuri cu {pct(iv.groupsPct[g.key], 2)} mai mari într-un an
            </span>
          </div>
        ))}
      </div>

      {iv.realSalary && (
        <div className="card">
          <span className="eyebrow">Salariul tău, în banii de azi</span>
          <p>
            {lei(iv.realSalary.gross)} brut azi cumpără cât <strong>{lei(iv.realSalary.nowWorth)}</strong> acum un an.
            {iv.realSalary.since ? ` Salariul nu s-a schimbat din ${iv.realSalary.since}.` : ''} O mărire sub{' '}
            {pct(iv.personal.personalPct, 1)} e, de fapt, o scădere a ce-ți permiți.
          </p>
        </div>
      )}

      <div className="card">
        <span className="eyebrow">{lei(iv.savings.amountLei)} economisiți un an, față de inflația ta</span>
        {iv.savings.rows.map((r) => (
          <div key={r.label} className="row">
            <span>
              {r.label} <span className="small muted">· {pct(r.netRatePct, 2)} după impozit</span>
            </span>
            <strong style={{ color: r.realChangeLei < 0 ? 'var(--accent-ink)' : 'var(--ink)' }}>
              {r.realChangeLei >= 0 ? '+' : '−'}
              {lei(Math.abs(r.realChangeLei))}
            </strong>
          </div>
        ))}
        {iv.savings.exampleRates && <p className="note">Rate exemplu pentru demo. Ratele reale vin de la fiecare furnizor.</p>}
        {showOptionsLink && (
          <Link href="/active/cont_economii" className="btn btn-ghost">
            Vezi opțiunile, ordonate neutru
          </Link>
        )}
      </div>

      {scenario && <ScenarioSlider {...scenario} />}

      <p className="note">
        Sursa: <a href={iv.source.url}>{iv.source.label}</a>. Coșul tău × ratele oficiale pe grupe. Educație, nu consultanță.
      </p>
    </div>
  );
}
