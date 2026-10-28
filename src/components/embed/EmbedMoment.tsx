'use client';

import { useState } from 'react';
import { InflationReveal } from '@/components/moments/InflationReveal';
import { PredictStep } from '@/components/moments/PredictStep';
import type { ScenarioSliderProps } from '@/components/moments/ScenarioSlider';
import type { InflationView } from '@/lib/moments/views';
import { lei } from '@/lib/format';

/**
 * The partner view: the same moment, inside a bank's app, in the bank's colours.
 * Nothing here is stored. The guess stays in the browser.
 */
export function EmbedMoment({ iv, scenario, bankName }: { iv: InflationView; scenario?: ScenarioSliderProps; bankName: string }) {
  const [step, setStep] = useState<'predict' | 'reveal' | 'done'>('predict');
  const [guess, setGuess] = useState<number>();

  if (step === 'predict') {
    return (
      <PredictStep
        question={`National inflation is ${iv.headlinePct}%. What's yours?`}
        min={0}
        max={15}
        step={0.5}
        unit="%"
        start={iv.headlinePct > 5 ? 3 : 8}
        onLock={async (v) => {
          setGuess(v);
          setStep('reveal');
        }}
      />
    );
  }

  if (step === 'reveal') {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <InflationReveal iv={iv} guess={guess} scenario={scenario} showOptionsLink={false} />
        {iv.bufferTarget !== undefined && (
          <div className="card">
            <span className="eyebrow">One thing to do</span>
            <h2>Keep your buffer worth the same</h2>
            <p className="muted">Set your savings goal to {lei(iv.bufferTarget)}: three months of spending, at your inflation.</p>
            <button className="btn btn-primary btn-block" onClick={() => setStep('done')}>
              Set goal in {bankName}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <h1>Goal set</h1>
      <p className="muted">In a live integration, {bankName}&apos;s app opens its own savings-goal screen here. Rost never moves money.</p>
    </div>
  );
}
