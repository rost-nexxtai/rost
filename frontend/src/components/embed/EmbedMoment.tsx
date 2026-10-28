'use client';

import { useState } from 'react';
import { InflationReveal } from '@/components/moments/InflationReveal';
import { PredictStep } from '@/components/lesson/steps/PredictStep';
import type { ScenarioSliderProps } from '@/components/moments/ScenarioSlider';
import type { InflationView } from '@/contract';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    question: (headline: string) => `Inflația la nivel național e ${headline}. Cât crezi că e a ta?`,
    explain: 'Inflația ta ține de pe ce cheltui: serviciile s-au scumpit mai mult decât mâncarea.',
    oneStep: 'Un singur pas',
    keep: 'Păstrează-ți fondul de urgență la valoare',
    target: (amount: string) => `Setează-ți ținta de economii la ${amount}: trei luni de cheltuieli, la inflația ta.`,
    set: (bank: string) => `Setează ținta în ${bank}`,
    done: 'Ținta e setată',
    doneBody: (bank: string) => `Într-o integrare reală, aici se deschide ecranul de obiective de economii din aplicația ${bank}. Rost nu mută niciodată bani.`,
  },
  {
    question: (headline) => `National inflation is ${headline}. What do you think yours is?`,
    explain: 'Your inflation depends on what you spend on: services went up more than food.',
    oneStep: 'One step',
    keep: 'Keep your emergency fund worth the same',
    target: (amount) => `Set your savings target to ${amount}: three months of spending, at your inflation.`,
    set: (bank) => `Set the target in ${bank}`,
    done: 'Target set',
    doneBody: (bank) => `In a real integration, this opens the savings goals screen in the ${bank} app. Rost never moves money.`,
  },
);

/**
 * The partner view: the same moment, inside a bank's app, in the bank's colours.
 * Nothing here is stored. The guess stays in the browser.
 */
export function EmbedMoment({ iv, scenario, bankName }: { iv: InflationView; scenario?: ScenarioSliderProps; bankName: string }) {
  const [step, setStep] = useState<'predict' | 'reveal' | 'done'>('predict');
  const [guess, setGuess] = useState<number>();
  const { lang, f } = useLang();
  const t = T[lang];

  if (step === 'predict') {
    return (
      <PredictStep
        question={t.question(f.pct(iv.headlinePct, 2))}
        min={0}
        max={15}
        step={0.5}
        unit="%"
        start={iv.headlinePct > 5 ? 3 : 8}
        answer={iv.personal.personalPct}
        explain={t.explain}
        onCheck={async (v) => setGuess(v)}
        onDone={() => setStep('reveal')}
      />
    );
  }

  if (step === 'reveal') {
    return (
      <div className="stack-lg">
        <InflationReveal iv={iv} guess={guess} scenario={scenario} showOptionsLink={false} />
        {iv.bufferTarget !== undefined && (
          <div className="card">
            <span className="eyebrow">{t.oneStep}</span>
            <h2>{t.keep}</h2>
            <p className="muted">{t.target(f.lei(iv.bufferTarget))}</p>
            <button className="btn btn-primary btn-block" onClick={() => setStep('done')}>
              {t.set(bankName)}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <h1>{t.done}</h1>
      <p className="muted">{t.doneBody(bankName)}</p>
    </div>
  );
}
