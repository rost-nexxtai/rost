'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { MomentResponse, Step } from '@/contract';
import { LessonBar } from '@/components/lesson/LessonBar';
import { LessonShell } from '@/components/lesson/LessonShell';
import { ActionStep } from '@/components/lesson/steps/ActionStep';
import { FinishStep } from '@/components/lesson/steps/FinishStep';
import { PredictStep } from '@/components/lesson/steps/PredictStep';
import { lei } from '@/lib/format';
import { scenarioProps } from '@/lib/scenario';
import { InflationReveal } from './InflationReveal';
import { PayslipReveal } from './PayslipReveal';
import { ScenarioSlider } from './ScenarioSlider';

/** Why the answer is what it is, keyed by the predict step's answer key. */
const EXPLAIN: Record<string, string> = {
  pension: 'Un sfert din brut merge la pensie (CAS 25%). Pe ecranul următor vezi unde ajunge fiecare leu.',
  personalPct: 'Inflația ta ține de pe ce cheltui: serviciile s-au scumpit mai mult decât mâncarea.',
};

const CONFIRM_LABEL: Record<string, string> = {
  payday_savings_rule: 'Îl setez în banca mea',
  update_buffer_target: 'Actualizează ținta',
};

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

  useEffect(() => {
    fetch(`/api/moments/${runId}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error ?? r.statusText))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [runId]);

  if (error) return <Message title="Nu putem deschide momentul" body={error} />;
  if (!data) return <p className="muted" style={{ padding: 20 }}>Se încarcă…</p>;

  const { def, view, run } = data;
  if (run.state === 'completed' && !done) return <Message title="Gata deja" body="Ai terminat momentul ăsta." />;
  const total = def.steps.length + 1;

  if (done) {
    const what =
      done.actionType === 'payday_savings_rule'
        ? `De ziua salariului muți ${lei(Number(done.params.amountLei))} în economii, din banca ta.`
        : `Ținta fondului de urgență e acum ${lei(Number(done.params.bufferTargetLei))}.`;
    return (
      <LessonShell index={total - 1} total={total}>
        <FinishStep
          title={def.title}
          takeaways={[what, 'Revenim peste o săptămână să vedem dacă ai făcut-o. Abia atunci se pune.']}
          right={results.filter(Boolean).length}
          graded={results.length}
          seconds={(Date.now() - started.current) / 1000}
          cta={{ label: 'Înapoi la Momente', href: '/momente' }}
          onFinish={async () => `Revenim peste ${def.followUpDays} zile.`}
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
          explain={EXPLAIN[step.answer]}
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
          <span className="lesson-kicker">Pe cifrele tale</span>
          {step.view === 'payslip' && view.payslip && <PayslipReveal p={view.payslip} />}
          {step.view === 'personal_inflation' && view.inflation && (
            <InflationReveal iv={view.inflation} scenario={view.scenario && scenarioProps(view.scenario)} />
          )}
          {step.view === 'scenario' && view.scenario && <ScenarioSlider {...scenarioProps(view.scenario)} />}
          <LessonBar label="Continuă" onClick={next} />
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
          <LessonBar label="Continuă" onClick={next} />
        </>
      )}

      {step.type === 'action' && (
        <ActionStep
          title={step.title}
          body={step.body}
          options={step.options}
          defaultOption={step.defaultOption}
          confirmLabel={CONFIRM_LABEL[step.action] ?? 'Gata'}
          onSubmit={(choice) => submitAction(step, choice)}
        />
      )}
    </LessonShell>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="lesson">
      <div className="lesson-body">
        <h1 className="lesson-q">{title}</h1>
        <p className="muted">{body}</p>
        <Link href="/momente" className="btn btn-primary">
          Înapoi la Momente
        </Link>
      </div>
    </main>
  );
}
