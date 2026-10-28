'use client';

import { useEffect, useRef, useState } from 'react';
import { feel } from '@/components/lesson/feel';
import { LessonShell } from '@/components/lesson/LessonShell';
import { ChoiceStep } from '@/components/lesson/steps/ChoiceStep';
import { ExploreStep } from '@/components/lesson/steps/ExploreStep';
import { FinishStep, type FinishOutcome } from '@/components/lesson/steps/FinishStep';
import { OrderStep } from '@/components/lesson/steps/OrderStep';
import { PredictStep } from '@/components/lesson/steps/PredictStep';
import { RangeStep } from '@/components/lesson/steps/RangeStep';
import { SortStep } from '@/components/lesson/steps/SortStep';
import { StatStep } from '@/components/lesson/steps/StatStep';
import { completeLibraryMoment, saveLessonProgress } from '@/data/actions';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import type { Asset, LessonProgress, Level, LibraryMoment } from '@/data/types';

const T = copy(
  {
    coreLeft: (left: number, next: Level) => (left === 1 ? `Încă o lecție de bază până la L${next}.` : `Încă ${left} lecții de bază până la L${next}.`),
    noProfile: 'Fă testul ca să-ți salvăm progresul.',
    levelUp: (level: Level) => `Ai urcat la nivelul L${level}. Ai lecții noi deblocate.`,
    ticked: 'Lecție bifată.',
    retake: (right: number, of: number) => `${right} din ${of} corecte. Ca lecția să conteze pentru nivel, ai nevoie de cel puțin două treimi. Mai încearc-o o dată.`,
  },
  {
    coreLeft: (left, next) => (left === 1 ? `One more core lesson to L${next}.` : `${left} more core lessons to L${next}.`),
    noProfile: 'Take the quiz so we can save your progress.',
    levelUp: (level) => `You moved up to level L${level}. New lessons unlocked.`,
    ticked: 'Lesson done.',
    retake: (right, of) => `${right} of ${of} right. For the lesson to count toward your level you need at least two thirds. Give it another go.`,
  },
);

/** Plays a library lesson, one screen at a time, and keeps score of the graded screens (first tries only). */
export function LibraryMomentPlayer({
  moment,
  assets,
  levelBefore,
  coreLeftAfter,
  bufferMonths,
  resume,
  upNext,
}: {
  moment: LibraryMoment;
  assets: Partial<Record<string, Asset>>;
  levelBefore: Level;
  /** Core lessons left at the current level once this one counts, computed on the server. */
  coreLeftAfter: number;
  /** Months of spending already saved (onboarding), so calculators start from there. */
  bufferMonths?: number;
  /** Where the user left this lesson last time; it picks up there. */
  resume?: LessonProgress;
  /** The lesson to offer once this one is done. */
  upNext?: { id: string; title: string; minutes: number };
}) {
  const [i, setI] = useState(resume?.step ?? 0);
  const [results, setResults] = useState<boolean[]>(resume?.results ?? []);
  const started = useRef(Date.now());
  const t = T[useLang().lang];
  const step = moment.steps[i];
  const last = moment.steps.length - 1;
  // Remember the place on every new screen, so leaving keeps the lesson "in progress".
  // The finish screen saves the completion instead.
  useEffect(() => {
    if (i > 0 && i < last) void saveLessonProgress(moment.id, { step: i, results, of: moment.steps.length }).catch(() => undefined);
    // results change together with i on graded screens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  const next = () => setI((n) => Math.min(n + 1, moment.steps.length - 1));
  const graded = (ok: boolean) => {
    setResults((r) => [...r, ok]);
    next();
  };
  // a failed lesson starts again from the top, with a clean score
  const retry = () => {
    setResults([]);
    started.current = Date.now();
    setI(0);
  };

  async function finish(): Promise<FinishOutcome> {
    const right = results.filter(Boolean).length;
    const res = await completeLibraryMoment(moment.id, right, results.length);
    if (!res) return { line: t.noProfile, passed: true };
    const { profile: after, passed, week } = res;
    if (passed) feel('done');
    const line = !passed
      ? t.retake(right, results.length)
      : after.level > levelBefore
        ? t.levelUp(after.level)
        : after.level === 2 || coreLeftAfter === 0
          ? t.ticked
          : t.coreLeft(coreLeftAfter, (after.level + 1) as Level);
    return { line, passed, week };
  }

  return (
    <LessonShell index={i} total={moment.steps.length}>
      {step.type === 'choice' && <ChoiceStep {...step} onDone={graded} />}
      {step.type === 'predict' && <PredictStep {...step} answer={step.answerValue} onDone={graded} />}
      {step.type === 'sort' && <SortStep {...step} onDone={graded} />}
      {step.type === 'order' && <OrderStep {...step} onDone={graded} />}
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
          upNext={upNext}
          onFinish={finish}
          onRetry={retry}
        />
      )}
    </LessonShell>
  );
}
