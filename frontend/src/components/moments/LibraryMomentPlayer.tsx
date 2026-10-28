'use client';

import { useRef, useState } from 'react';
import { LessonShell } from '@/components/lesson/LessonShell';
import { ChoiceStep } from '@/components/lesson/steps/ChoiceStep';
import { ExploreStep } from '@/components/lesson/steps/ExploreStep';
import { FinishStep } from '@/components/lesson/steps/FinishStep';
import { PredictStep } from '@/components/lesson/steps/PredictStep';
import { RangeStep } from '@/components/lesson/steps/RangeStep';
import { SortStep } from '@/components/lesson/steps/SortStep';
import { StatStep } from '@/components/lesson/steps/StatStep';
import { completeLibraryMoment } from '@/data/actions';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import type { Asset, Level, LibraryMoment } from '@/data/types';

const T = copy(
  {
    coreLeft: (left: number, next: Level) => (left === 1 ? `Încă o lecție de bază până la L${next}.` : `Încă ${left} lecții de bază până la L${next}.`),
    noProfile: 'Fă testul ca să-ți salvăm progresul.',
    levelUp: (level: Level) => `Ai urcat la nivelul L${level}. Ai lecții noi deblocate.`,
    ticked: 'Lecție bifată.',
  },
  {
    coreLeft: (left, next) => (left === 1 ? `One more core lesson to L${next}.` : `${left} more core lessons to L${next}.`),
    noProfile: 'Take the quiz so we can save your progress.',
    levelUp: (level) => `You moved up to level L${level}. New lessons unlocked.`,
    ticked: 'Lesson done.',
  },
);

/** Plays a library lesson, one screen at a time, and keeps score of the graded screens. */
export function LibraryMomentPlayer({
  moment,
  assets,
  levelBefore,
  coreLeftAfter,
  bufferMonths,
}: {
  moment: LibraryMoment;
  assets: Partial<Record<string, Asset>>;
  levelBefore: Level;
  /** Core lessons left at the current level once this one counts, computed on the server. */
  coreLeftAfter: number;
  /** Months of spending already saved (onboarding), so calculators start from there. */
  bufferMonths?: number;
}) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const started = useRef(Date.now());
  const t = T[useLang().lang];
  const step = moment.steps[i];
  const next = () => setI((n) => Math.min(n + 1, moment.steps.length - 1));
  const graded = (ok: boolean) => {
    setResults((r) => [...r, ok]);
    next();
  };

  async function finish(): Promise<string> {
    const after = await completeLibraryMoment(moment.id);
    if (!after) return t.noProfile;
    if (after.level > levelBefore) return t.levelUp(after.level);
    if (after.level === 2) return t.ticked;
    return coreLeftAfter > 0 ? t.coreLeft(coreLeftAfter, (after.level + 1) as Level) : t.ticked;
  }

  return (
    <LessonShell index={i} total={moment.steps.length}>
      {step.type === 'choice' && <ChoiceStep {...step} onDone={graded} />}
      {step.type === 'predict' && <PredictStep {...step} answer={step.answerValue} onDone={graded} />}
      {step.type === 'sort' && <SortStep {...step} onDone={graded} />}
      {step.type === 'explore' && <ExploreStep {...step} haveMonths={bufferMonths} onDone={next} />}
      {step.type === 'stat' && <StatStep {...step} onDone={next} />}
      {step.type === 'asset_range' && assets[step.assetId] && <RangeStep asset={assets[step.assetId]!} onDone={next} />}
      {step.type === 'finish' && (
        <FinishStep
          title={moment.title}
          takeaways={moment.takeaways}
          right={results.filter(Boolean).length}
          graded={results.length}
          seconds={(Date.now() - started.current) / 1000}
          cta={step.cta}
          onFinish={finish}
        />
      )}
    </LessonShell>
  );
}
