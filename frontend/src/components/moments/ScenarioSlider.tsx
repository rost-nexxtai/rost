'use client';

import { useState } from 'react';
import { lei } from '@/lib/format';
import { scenarioExtra } from '@/lib/scenario';

const LINE_LABEL = { fuel: 'fuel', utilities: 'utilities', food: 'groceries' } as const;

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
        <span className="eyebrow">What if</span>
        <span className="badge">Scenario, not a forecast</span>
      </div>
      <h2>{props.title}</h2>
      {props.context && <p className="muted small">{props.context}</p>}
      <label className="stack" style={{ gap: 4 }}>
        <span>
          If {label} costs <strong>{shock}%</strong> more
        </span>
        <input
          type="range"
          min={props.minPct}
          max={props.maxPct}
          step={5}
          value={shock}
          onChange={(e) => setShock(Number(e.target.value))}
          aria-label={`Price rise for ${label}, percent`}
        />
      </label>
      <div className="row">
        <span className="muted">
          You spend {lei(props.monthlySpend)} a month on {label}
        </span>
      </div>
      <div className="big" aria-live="polite">
        +{lei(extra)}
        <span className="small muted" style={{ fontFamily: 'var(--body)', letterSpacing: 0, marginLeft: 6 }}>
          a month
        </span>
      </div>
      <p className="small muted">That&apos;s {lei(extra * 12)} a year your buffer would need to absorb.</p>
      {props.reviewedBy && <p className="note">Scenario reviewed by {props.reviewedBy}.</p>}
    </div>
  );
}
