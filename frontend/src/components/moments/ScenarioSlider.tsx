'use client';

import { useState } from 'react';
import { lei } from '@/lib/format';
import { scenarioExtra } from '@/lib/scenario';

const LINE_LABEL = { fuel: 'carburantul', utilities: 'utilitățile', food: 'mâncarea' } as const;

export interface ScenarioSliderProps {
  title: string;
  context?: string;
  spendLine: keyof typeof LINE_LABEL;
  monthlySpend: number;
  minPct: number;
  maxPct: number;
  defaultPct: number;
  reviewedBy?: string;
}

/** A what-if on one spending line. Always labelled a scenario: Rost never forecasts prices. */
export function ScenarioSlider(props: ScenarioSliderProps) {
  const [shock, setShock] = useState(props.defaultPct);
  const extra = scenarioExtra(props.monthlySpend, shock);
  const label = LINE_LABEL[props.spendLine];

  return (
    <div className="card">
      <div className="row">
        <span className="eyebrow">Ce-ar fi dacă</span>
        <span className="tag tag-scenario">scenariu, nu prognoză</span>
      </div>
      <h2>{props.title}</h2>
      {props.context && <p className="muted small">{props.context}</p>}
      <label className="stack" style={{ gap: 4 }}>
        <span>
          Dacă {label} costă cu <strong>{shock}%</strong> mai mult
        </span>
        <input
          type="range"
          min={props.minPct}
          max={props.maxPct}
          step={5}
          value={shock}
          onChange={(e) => setShock(Number(e.target.value))}
          aria-label={`Creșterea prețului pentru ${label}, procente`}
        />
      </label>
      <div className="row">
        <span className="muted">
          Cheltui {lei(props.monthlySpend)} pe lună pe {label}
        </span>
      </div>
      <div className="big" aria-live="polite">
        +{lei(extra)}
        <span className="small muted" style={{ fontFamily: 'var(--body)', letterSpacing: 0, marginLeft: 6 }}>
          pe lună
        </span>
      </div>
      <p className="small muted">Adică {lei(extra * 12)} pe an pe care fondul de urgență ar trebui să-i acopere.</p>
      {props.reviewedBy && <p className="note">Scenariu verificat de {props.reviewedBy}.</p>}
    </div>
  );
}
