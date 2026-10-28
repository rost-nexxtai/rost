'use client';

import { useState } from 'react';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { scenarioExtra } from '@/lib/scenario';

type Line = 'fuel' | 'utilities' | 'food';

const T = copy(
  {
    line: { fuel: 'carburantul', utilities: 'utilitățile', food: 'mâncarea' } as Record<Line, string>,
    whatIf: 'Ce-ar fi dacă',
    scenario: 'scenariu, nu prognoză',
    costsMore: (label: string) => [`Dacă ${label} costă cu `, ' mai mult'],
    rise: (label: string) => `Creșterea prețului pentru ${label}, procente`,
    spend: (amount: string, label: string) => `Cheltui ${amount} pe lună pe ${label}`,
    perMonth: 'pe lună',
    perYear: (amount: string) => `Adică ${amount} pe an pe care fondul de urgență ar trebui să-i acopere.`,
    reviewed: (by: string) => `Scenariu verificat de ${by}.`,
  },
  {
    line: { fuel: 'fuel', utilities: 'utilities', food: 'food' },
    whatIf: 'What if',
    scenario: 'a scenario, not a forecast',
    costsMore: (label) => [`If ${label} costs `, ' more'],
    rise: (label) => `Price rise for ${label}, percent`,
    spend: (amount, label) => `You spend ${amount} a month on ${label}`,
    perMonth: 'a month',
    perYear: (amount) => `That's ${amount} a year your emergency fund would have to cover.`,
    reviewed: (by) => `Scenario checked by ${by}.`,
  },
);

export interface ScenarioSliderProps {
  title: string;
  context?: string;
  spendLine: Line;
  monthlySpend: number;
  minPct: number;
  maxPct: number;
  defaultPct: number;
  reviewedBy?: string;
}

/** A what-if on one spending line. Always labelled a scenario: Rost never forecasts prices. */
export function ScenarioSlider(props: ScenarioSliderProps) {
  const { lang, f } = useLang();
  const t = T[lang];
  const [shock, setShock] = useState(props.defaultPct);
  const extra = scenarioExtra(props.monthlySpend, shock);
  const label = t.line[props.spendLine];
  const [before, after] = t.costsMore(label);

  return (
    <div className="card">
      <div className="row">
        <span className="eyebrow">{t.whatIf}</span>
        <span className="tag tag-scenario">{t.scenario}</span>
      </div>
      <h2>{props.title}</h2>
      {props.context && <p className="muted small">{props.context}</p>}
      <label className="stack" style={{ gap: 4 }}>
        <span>
          {before}
          <strong>{shock}%</strong>
          {after}
        </span>
        <input type="range" min={props.minPct} max={props.maxPct} step={5} value={shock} onChange={(e) => setShock(Number(e.target.value))} aria-label={t.rise(label)} />
      </label>
      <div className="row">
        <span className="muted">{t.spend(f.lei(props.monthlySpend), label)}</span>
      </div>
      <div className="big" aria-live="polite">
        +{f.lei(extra)}
        <span className="small muted" style={{ fontFamily: 'var(--body)', letterSpacing: 0, marginLeft: 6 }}>
          {t.perMonth}
        </span>
      </div>
      <p className="small muted">{t.perYear(f.lei(extra * 12))}</p>
      {props.reviewedBy && <p className="note">{t.reviewed(props.reviewedBy)}</p>}
    </div>
  );
}
