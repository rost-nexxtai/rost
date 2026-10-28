'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MomentResponse, Step } from '@backend/contract';
import { lei } from '@/lib/format';
import { scenarioProps } from '@/lib/scenario';
import { ActionStep } from './ActionStep';
import { InflationReveal } from './InflationReveal';
import { PayslipReveal } from './PayslipReveal';
import { PredictStep } from './PredictStep';
import { ScenarioSlider } from './ScenarioSlider';

type Loaded = MomentResponse;

const CONFIRM_LABEL: Record<string, string> = {
  payday_savings_rule: "I'll set it up in my bank",
  update_buffer_target: 'Update my target',
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

/** Plays one moment: predict → reveal → card → one action, from the JSON definition in data/moments. */
export function MomentPlayer({ runId }: { runId: string }) {
  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState('');
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState<number>();
  const [done, setDone] = useState<{ actionType: string; params: Record<string, unknown> }>();

  useEffect(() => {
    fetch(`/api/moments/${runId}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error ?? r.statusText))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [runId]);

  if (error) return <Message title="Can't open this moment" body={error} />;
  if (!data) return <p className="muted">Loading…</p>;

  const { def, view, run } = data;
  if (run.state === 'completed' && !done) return <Message title="Already done" body="You've completed this moment." />;

  if (done) {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <span className="eyebrow">Done · {def.title}</span>
        <h1>Set. We&apos;ll check in {def.followUpDays} days.</h1>
        <p className="muted">
          {done.actionType === 'payday_savings_rule'
            ? `Next payday, move ${lei(Number(done.params.amountLei))} into savings in your own bank.`
            : `Your buffer target is now ${lei(Number(done.params.bufferTargetLei))}.`}{' '}
          An action only counts once you tell us you did it.
        </p>
        <Link href="/today" className="btn btn-primary btn-block">
          Back to today
        </Link>
        <Link href="/options" className="btn btn-ghost btn-block">
          Compare where to keep your savings
        </Link>
      </div>
    );
  }

  const step: Step = def.steps[i];
  const next = () => setI((n) => Math.min(n + 1, def.steps.length - 1));

  async function submitAction(s: Extract<Step, { type: 'action' }>, choice: number | null) {
    const params =
      s.action === 'payday_savings_rule' ? { amountLei: choice } : { bufferTargetLei: view.inflation?.bufferTarget ?? null };
    try {
      await post(runId, { kind: 'action', actionType: s.action, params });
      setDone({ actionType: s.action, params });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="row">
        <span className="small muted">
          {def.series} · {def.title}
        </span>
        <Link href="/today" className="small" aria-label="Close and come back later">
          Close
        </Link>
      </header>
      <div className="bar" aria-label={`Step ${i + 1} of ${def.steps.length}`}>
        <div style={{ width: `${((i + 1) / def.steps.length) * 100}%`, background: 'var(--accent)' }} />
      </div>

      {step.type === 'predict' && (
        <PredictStep
          key={i}
          question={step.question}
          min={step.min}
          max={step.max}
          step={step.step}
          unit={step.unit}
          start={step.start}
          onLock={async (value) => {
            try {
              await post(runId, { kind: 'guess', value, answerKey: step.answer });
              setGuess(value);
              next();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}

      {step.type === 'reveal' && (
        <>
          {step.view === 'payslip' && view.payslip && <PayslipReveal p={view.payslip} guess={guess} />}
          {step.view === 'personal_inflation' && view.inflation && (
            <InflationReveal iv={view.inflation} guess={guess} scenario={view.scenario && scenarioProps(view.scenario)} />
          )}
          {step.view === 'scenario' && view.scenario && <ScenarioSlider {...scenarioProps(view.scenario)} />}
          <button className="btn btn-primary btn-block" onClick={next}>
            Next
          </button>
        </>
      )}

      {step.type === 'card' && (
        <>
          <div className="card card-tint">
            <h2>{step.title}</h2>
            <p>{step.body}</p>
            {step.link && (
              <a href={step.link.href} target="_blank" rel="noreferrer">
                {step.link.label}
              </a>
            )}
          </div>
          <button className="btn btn-primary btn-block" onClick={next}>
            Next
          </button>
        </>
      )}

      {step.type === 'action' && (
        <ActionStep
          key={i}
          title={step.title}
          body={step.body}
          options={step.options}
          defaultOption={step.defaultOption}
          confirmLabel={CONFIRM_LABEL[step.action] ?? 'Done'}
          onSubmit={(choice) => submitAction(step, choice)}
        />
      )}
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="stack">
      <h1>{title}</h1>
      <p className="muted">{body}</p>
      <Link href="/today" className="btn btn-primary">
        Back to today
      </Link>
    </div>
  );
}
