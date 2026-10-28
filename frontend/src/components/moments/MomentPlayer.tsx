'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { MomentResponse, Step } from '@/contract';
import { LessonBar } from '@/components/lesson/LessonBar';
import { LessonShell } from '@/components/lesson/LessonShell';
import { ActionStep } from '@/components/lesson/steps/ActionStep';
import { FinishStep } from '@/components/lesson/steps/FinishStep';
import { PredictStep } from '@/components/lesson/steps/PredictStep';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { scenarioProps } from '@/lib/scenario';
import { InflationReveal } from './InflationReveal';
import { PayslipReveal } from './PayslipReveal';
import { ScenarioSlider } from './ScenarioSlider';

const T = copy(
  {
    // Why the answer is what it is, keyed by the predict step's answer key.
    explain: {
      pension: 'Un sfert din brut merge la pensie (CAS 25%). Pe ecranul următor vezi unde ajunge fiecare leu.',
      personalPct: 'Inflația ta ține de pe ce cheltui: serviciile s-au scumpit mai mult decât mâncarea.',
    } as Record<string, string>,
    confirm: { payday_savings_rule: 'Îl setez în banca mea', update_buffer_target: 'Actualizează ținta' } as Record<string, string>,
    done: 'Gata',
    cantOpen: 'Nu putem deschide momentul',
    loading: 'Se încarcă…',
    alreadyDone: 'Gata deja',
    alreadyDoneBody: 'Ai terminat momentul ăsta.',
    savingsRule: (amount: string) => `De ziua salariului muți ${amount} în economii, din banca ta.`,
    bufferTarget: (amount: string) => `Ținta fondului de urgență e acum ${amount}.`,
    checkBack: 'Revenim peste o săptămână să vedem dacă ai făcut-o. Abia atunci contează ca pas făcut.',
    backIn: (days: number) => `Revenim peste ${days} zile.`,
    back: 'Înapoi la Momente',
    savings: 'Vezi unde îți poți ține economiile',
    yourNumbers: 'Pe cifrele tale',
    continue: 'Continuă',
  },
  {
    explain: {
      pension: 'A quarter of gross goes to your pension (CAS 25%). The next screen shows where every leu goes.',
      personalPct: 'Your inflation depends on what you spend on: services went up more than food.',
    },
    confirm: { payday_savings_rule: "I'll set it up in my bank", update_buffer_target: 'Update my target' },
    done: 'Done',
    cantOpen: "We can't open this moment",
    loading: 'Loading…',
    alreadyDone: 'Already done',
    alreadyDoneBody: "You've finished this moment.",
    savingsRule: (amount) => `On payday you move ${amount} into savings, in your own bank.`,
    bufferTarget: (amount) => `Your emergency fund target is now ${amount}.`,
    checkBack: "We'll check in a week to see if you did it. Only then does it count.",
    backIn: (days) => `We'll check back in ${days} days.`,
    back: 'Back to Moments',
    savings: 'See where to keep your savings',
    yourNumbers: 'On your numbers',
    continue: 'Continue',
  },
);

async function post(runId: string, body: unknown) {
  const res = await fetch(`/api/moments/${runId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

/** Plays a moment the backend opened (payday, inflation, what-if): guess → your numbers → one action. */
export function MomentPlayer({ runId }: { runId: string }) {
  const [data, setData] = useState<MomentResponse>();
  const [error, setError] = useState('');
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState<{ actionType: string; params: Record<string, unknown> }>();
  const started = useRef(Date.now());
  const { lang, f } = useLang();
  const t = T[lang];

  useEffect(() => {
    fetch(`/api/moments/${runId}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error ?? r.statusText))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [runId]);

  if (error) return <Message title={t.cantOpen} body={error} back={t.back} />;
  if (!data) return <p className="muted" style={{ padding: 20 }}>{t.loading}</p>;

  const { def, view, run } = data;
  if (run.state === 'completed' && !done) return <Message title={t.alreadyDone} body={t.alreadyDoneBody} back={t.back} />;
  const total = def.steps.length + 1;

  if (done) {
    const what =
      done.actionType === 'payday_savings_rule'
        ? t.savingsRule(f.lei(Number(done.params.amountLei)))
        : t.bufferTarget(f.lei(Number(done.params.bufferTargetLei)));
    return (
      <LessonShell index={total - 1} total={total}>
        <FinishStep
          title={def.title}
          takeaways={[what, t.checkBack]}
          right={results.filter(Boolean).length}
          graded={results.length}
          seconds={(Date.now() - started.current) / 1000}
          cta={{ label: t.savings, href: '/active/cont_economii' }}
          onFinish={async () => t.backIn(def.followUpDays)}
        />
      </LessonShell>
    );
  }

  const step: Step = def.steps[i];
  const next = () => setI((n) => Math.min(n + 1, def.steps.length - 1));

  async function submitAction(s: Extract<Step, { type: 'action' }>, choice: number | null) {
    const params = s.action === 'payday_savings_rule' ? { amountLei: choice } : { bufferTargetLei: view.inflation?.bufferTarget ?? null };
    try {
      await post(runId, { kind: 'action', actionType: s.action, params });
      setDone({ actionType: s.action, params });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <LessonShell index={i} total={total}>
      {step.type === 'predict' && (
        <PredictStep
          question={step.question}
          min={step.min}
          max={step.max}
          step={step.step}
          unit={step.unit}
          start={step.start}
          answer={view.answers[step.answer] ?? 0}
          explain={t.explain[step.answer]}
          onCheck={async (value) => {
            try {
              await post(runId, { kind: 'guess', value, answerKey: step.answer });
            } catch (e) {
              setError((e as Error).message);
              throw e;
            }
          }}
          onDone={(ok) => {
            setResults((r) => [...r, ok]);
            next();
          }}
        />
      )}

      {step.type === 'reveal' && (
        <>
          <span className="lesson-kicker">{t.yourNumbers}</span>
          {step.view === 'payslip' && view.payslip && <PayslipReveal p={view.payslip} />}
          {step.view === 'personal_inflation' && view.inflation && (
            <InflationReveal iv={view.inflation} scenario={view.scenario && scenarioProps(view.scenario)} />
          )}
          {step.view === 'scenario' && view.scenario && <ScenarioSlider {...scenarioProps(view.scenario)} />}
          <LessonBar label={t.continue} onClick={next} />
        </>
      )}

      {step.type === 'card' && (
        <>
          <h1 className="lesson-q">{step.title}</h1>
          <p className="lesson-text">{step.body}</p>
          {step.link && (
            <a href={step.link.href} target="_blank" rel="noreferrer" className="small">
              {step.link.label}
            </a>
          )}
          <LessonBar label={t.continue} onClick={next} />
        </>
      )}

      {step.type === 'action' && (
        <ActionStep
          title={step.title}
          body={step.body}
          options={step.options}
          defaultOption={step.defaultOption}
          confirmLabel={t.confirm[step.action] ?? t.done}
          onSubmit={(choice) => submitAction(step, choice)}
        />
      )}
    </LessonShell>
  );
}

function Message({ title, body, back }: { title: string; body: string; back: string }) {
  return (
    <main className="lesson">
      <div className="lesson-body">
        <h1 className="lesson-q">{title}</h1>
        <p className="muted">{body}</p>
        <Link href="/momente" className="btn btn-primary">
          {back}
        </Link>
      </div>
    </main>
  );
}
