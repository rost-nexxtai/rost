'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MomentResponse, Step } from '@/contract';
import { lei } from '@/lib/format';
import { scenarioProps } from '@/lib/scenario';
import { ActionStep } from './steps/ActionStep';
import { InflationReveal } from './InflationReveal';
import { PayslipReveal } from './PayslipReveal';
import { PredictStep } from './steps/PredictStep';
import { ScenarioSlider } from './ScenarioSlider';

type Loaded = MomentResponse;

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

  if (error) return <Message title="Nu putem deschide momentul" body={error} />;
  if (!data) return <p className="muted">Se încarcă…</p>;

  const { def, view, run } = data;
  if (run.state === 'completed' && !done) return <Message title="Gata deja" body="Ai terminat momentul ăsta." />;

  if (done) {
    return (
      <div className="stack-lg rise">
        <span className="eyebrow">Gata · {def.title}</span>
        <h1>Gata. Revenim peste {def.followUpDays} zile.</h1>
        <p className="muted">
          {done.actionType === 'payday_savings_rule'
            ? `De ziua salariului, mută ${lei(Number(done.params.amountLei))} în economii, din banca ta.`
            : `Ținta pentru fondul de urgență e acum ${lei(Number(done.params.bufferTargetLei))}.`}{' '}
          O acțiune contează doar după ce ne spui că ai făcut-o.
        </p>
        <Link href="/momente" className="btn btn-primary btn-block">
          Înapoi la Momente
        </Link>
        <Link href="/active/cont_economii" className="btn btn-ghost btn-block">
          Vezi unde îți poți ține economiile
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
    <div className="stack-lg">
      <header className="row">
        <span className="small muted">
          {def.series} · {def.title}
        </span>
        <Link href="/momente" className="small" aria-label="Închide și revino mai târziu">
          Închide
        </Link>
      </header>
      <div className="bar" aria-label={`Pasul ${i + 1} din ${def.steps.length}`}>
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
            Mai departe
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
            Mai departe
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
      <Link href="/momente" className="btn btn-primary">
        Înapoi la Momente
      </Link>
    </div>
  );
}
