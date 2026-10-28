'use client';

import { useState } from 'react';
import { InflationReveal } from '@/components/moments/InflationReveal';
import { PredictStep } from '@/components/moments/steps/PredictStep';
import type { ScenarioSliderProps } from '@/components/moments/ScenarioSlider';
import type { InflationView } from '@backend/contract';
import { lei, pct } from '@/lib/format';

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
        question={`Inflația la nivel național e ${pct(iv.headlinePct, 2)}. Cât crezi că e a ta?`}
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
      <div className="stack-lg">
        <InflationReveal iv={iv} guess={guess} scenario={scenario} showOptionsLink={false} />
        {iv.bufferTarget !== undefined && (
          <div className="card">
            <span className="eyebrow">Un singur pas</span>
            <h2>Păstrează-ți fondul de urgență la valoare</h2>
            <p className="muted">Setează-ți ținta de economii la {lei(iv.bufferTarget)}: trei luni de cheltuieli, la inflația ta.</p>
            <button className="btn btn-primary btn-block" onClick={() => setStep('done')}>
              Setează ținta în {bankName}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <h1>Ținta e setată</h1>
      <p className="muted">Într-o integrare reală, aici se deschide ecranul de obiective de economii din aplicația {bankName}. Rost nu mută niciodată bani.</p>
    </div>
  );
}
