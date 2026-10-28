'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { completeLibraryMoment } from '@/data/actions';
import type { Asset, Level, LibraryMoment } from '@/data/types';
import { AssetRangeStep } from './steps/AssetRangeStep';
import { CardStep } from './steps/CardStep';
import { ChoiceStep } from './steps/ChoiceStep';
import { FinishStep } from './steps/FinishStep';
import { PredictStep } from './steps/PredictStep';

const CORE_LEFT = (left: number, next: Level) =>
  left === 1 ? `Încă o lecție de bază până la L${next}.` : `Încă ${left} lecții de bază până la L${next}.`;

/** Plays a library lesson from its JSON-like definition. Progress is saved when the last step shows. */
export function LibraryMomentPlayer({
  moment,
  assets,
  levelBefore,
  coreLeftAfter,
}: {
  moment: LibraryMoment;
  assets: Partial<Record<string, Asset>>;
  levelBefore: Level;
  /** Core lessons left at the current level once this one counts, computed on the server. */
  coreLeftAfter: number;
}) {
  const [i, setI] = useState(0);
  const step = moment.steps[i];
  const next = () => setI((n) => Math.min(n + 1, moment.steps.length - 1));

  async function finish(): Promise<string> {
    const after = await completeLibraryMoment(moment.id);
    if (!after) return 'Fă testul ca să-ți salvăm progresul.';
    if (after.level > levelBefore) return `Ai trecut la nivelul L${after.level}. Ți-am deblocat lecțiile următoare.`;
    if (after.level === 2) return 'Lecție bifată.';
    return coreLeftAfter > 0 ? CORE_LEFT(coreLeftAfter, (after.level + 1) as Level) : 'Lecție bifată.';
  }

  return (
    <div className="stack-lg">
      <header className="stack" style={{ gap: 10 }}>
        <div className="row">
          <span className="small muted">
            {moment.series} · {moment.title}
          </span>
          <Link href="/momente" className="small" aria-label="Închide și revino mai târziu">
            Închide
          </Link>
        </div>
        <ProgressBar value={i + 1} max={moment.steps.length} label={`Pasul ${i + 1} din ${moment.steps.length}`} />
      </header>

      {step.type === 'choice' && <ChoiceStep key={i} {...step} onNext={next} />}
      {step.type === 'predict' && <PredictStep key={i} {...step} answer={step.answerValue} onNext={next} />}
      {step.type === 'card' && <CardStep key={i} title={step.title} body={step.body} onNext={next} />}
      {step.type === 'asset_range' && assets[step.assetId] && <AssetRangeStep key={i} asset={assets[step.assetId]!} onNext={next} />}
      {step.type === 'finish' && <FinishStep key={i} cta={step.cta} onFinish={finish} />}
    </div>
  );
}
