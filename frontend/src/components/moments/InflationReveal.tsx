'use client';

import Link from 'next/link';
import type { InflationView } from '@/contract';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { ScenarioSlider, type ScenarioSliderProps } from './ScenarioSlider';

type Group = 'services' | 'nonFood' | 'food';

const T = copy(
  {
    groups: {
      services: { label: 'Servicii', hint: 'chirie, transport, telefon' },
      nonFood: { label: 'Cumpărături și carburant', hint: 'mărfuri nealimentare' },
      food: { label: 'Mâncare', hint: 'mărfuri alimentare' },
    } as Record<Group, { label: string; hint: string }>,
    yours: (period: string) => `Inflația ta · ${period}`,
    vsNational: (national: string, points: string, higher: boolean) =>
      `La nivel național: ${national}. A ta e cu ${points} puncte ${higher ? 'mai mare' : 'mai mică'}`,
    youSaid: (v: string) => `. Tu ai zis ${v}.`,
    why: 'De ce',
    share: (pct: number) => `${pct}% din cheltuieli`,
    points: (v: string) => `+${v} pct.`,
    groupRise: (hint: string, pct: string) => `${hint}: prețuri cu ${pct} mai mari într-un an`,
    realSalary: 'Salariul tău, în banii de azi',
    buys: (gross: string, worth: string) => [`${gross} brut azi cumpără cât `, worth, ' acum un an.'],
    since: (date: string) => ` Salariul nu s-a schimbat din ${date}.`,
    raise: (pct: string) => ` O mărire sub ${pct} e, de fapt, o scădere a ce-ți permiți.`,
    savings: (amount: string) => `${amount} economisiți un an, față de inflația ta`,
    afterTax: (pct: string) => `${pct} după impozit`,
    exampleRates: 'Rate exemplu pentru demo. Ratele reale vin de la fiecare furnizor.',
    options: 'Vezi opțiunile, ordonate neutru',
    source: 'Sursa:',
    method: 'Coșul tău × ratele oficiale pe grupe. Educație, nu consultanță.',
  },
  {
    groups: {
      services: { label: 'Services', hint: 'rent, transport, phone' },
      nonFood: { label: 'Shopping and fuel', hint: 'non-food goods' },
      food: { label: 'Food', hint: 'food' },
    },
    yours: (period) => `Your inflation · ${period}`,
    vsNational: (national, points, higher) => `National: ${national}. Yours is ${points} points ${higher ? 'higher' : 'lower'}`,
    youSaid: (v) => `. You said ${v}.`,
    why: 'Why',
    share: (pct) => `${pct}% of spending`,
    points: (v) => `+${v} pts`,
    groupRise: (hint, pct) => `${hint}: prices up ${pct} in a year`,
    realSalary: "Your salary, in today's money",
    buys: (gross, worth) => [`${gross} gross today buys what `, worth, ' did a year ago.'],
    since: (date) => ` Your salary hasn't changed since ${date}.`,
    raise: (pct) => ` A raise below ${pct} is really a cut in what you can afford.`,
    savings: (amount) => `${amount} saved for a year, against your inflation`,
    afterTax: (pct) => `${pct} after tax`,
    exampleRates: 'Example rates for the demo. Real rates come from each provider.',
    options: 'See the options, ranked neutrally',
    source: 'Source:',
    method: 'Your basket × the official rates per group. Education, not advice.',
  },
);

const GROUPS: Group[] = ['services', 'nonFood', 'food'];

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
  const { lang, f } = useLang();
  const t = T[lang];
  const personal = iv.personal.personalPct;
  const diff = Math.round((personal - iv.headlinePct) * 100) / 100;
  const maxContribution = Math.max(...GROUPS.map((g) => iv.personal.contributions[g]), 0.01);
  const points = (v: number) => f.pct(v, 2).replace('%', '');

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card card-dark">
        <span className="eyebrow">{t.yours(iv.period)}</span>
        <div className="big">{f.pct(personal, 2)}</div>
        <p className="muted">
          {t.vsNational(f.pct(iv.headlinePct, 2), points(Math.abs(diff)), diff >= 0)}
          {guess !== undefined ? t.youSaid(f.pct(guess)) : '.'}
        </p>
      </div>

      <div className="card">
        <h2>{t.why}</h2>
        {GROUPS.map((g) => (
          <div key={g} className="stack" style={{ gap: 4 }}>
            <div className="row">
              <span>
                {t.groups[g].label} <span className="small muted">· {t.share(Math.round(iv.personal.shares[g] * 100))}</span>
              </span>
              <strong>{t.points(points(iv.personal.contributions[g]))}</strong>
            </div>
            <div className="bar">
              <div
                style={{
                  width: `${(iv.personal.contributions[g] / maxContribution) * 100}%`,
                  background: g === 'services' ? 'var(--accent)' : 'var(--muted)',
                }}
              />
            </div>
            <span className="small muted">{t.groupRise(t.groups[g].hint, f.pct(iv.groupsPct[g], 2))}</span>
          </div>
        ))}
      </div>

      {iv.realSalary && (
        <div className="card">
          <span className="eyebrow">{t.realSalary}</span>
          <p>
            {(([before, worth, after]) => (
              <>
                {before}
                <strong>{worth}</strong>
                {after}
              </>
            ))(t.buys(f.lei(iv.realSalary.gross), f.lei(iv.realSalary.nowWorth)))}
            {iv.realSalary.since ? t.since(iv.realSalary.since) : ''}
            {t.raise(f.pct(iv.personal.personalPct, 1))}
          </p>
        </div>
      )}

      <div className="card">
        <span className="eyebrow">{t.savings(f.lei(iv.savings.amountLei))}</span>
        {iv.savings.rows.map((r) => (
          <div key={r.label} className="row">
            <span>
              {r.label} <span className="small muted">· {t.afterTax(f.pct(r.netRatePct, 2))}</span>
            </span>
            <strong style={{ color: r.realChangeLei < 0 ? 'var(--accent-ink)' : 'var(--ink)' }}>{f.leiSigned(r.realChangeLei)}</strong>
          </div>
        ))}
        {iv.savings.exampleRates && <p className="note">{t.exampleRates}</p>}
        {showOptionsLink && (
          <Link href="/active/cont_economii" className="btn btn-ghost">
            {t.options}
          </Link>
        )}
      </div>

      {scenario && <ScenarioSlider {...scenario} />}

      <p className="note">
        {t.source} <a href={iv.source.url}>{iv.source.label}</a>. {t.method}
      </p>
    </div>
  );
}
