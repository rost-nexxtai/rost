'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Icon } from '@/components/ui/Icon';
import { saveQuiz } from '@/data/actions';
import { QUIZ } from '@/data/fixtures/quiz';
import type { AgeBand, KnowledgeAnswer, MoneyHorizon, Profile, QuizAnswers, Situation } from '@/data/types';
import { QuizResult } from './QuizResult';
import { QuizStep, type QuizOption } from './QuizStep';

const NU_STIU = { value: 'nu_stiu' as const, label: 'Nu știu' };

type Draft = Partial<Omit<QuizAnswers, 'knowledge'>> & { knowledge: (KnowledgeAnswer | undefined)[] };
type Money = { grossMonthly: string; fuelLei: string; electricityLei: string; savedLei: string };

const PROFILE_STEPS = [
  { key: 'ageBand', question: 'Câți ani ai?', options: QUIZ.profile.ageBand },
  { key: 'situation', question: 'Care e situația ta acum?', options: QUIZ.profile.situation },
  {
    key: 'bufferMonths',
    question: 'Dacă venitul s-ar opri mâine, câte luni ai trăi din economii?',
    options: QUIZ.profile.bufferMonths,
  },
  {
    key: 'expensiveDebt',
    question: 'Ai datorii scumpe?',
    hint: 'Card de credit neachitat integral, credit de nevoi personale sau „cumpără acum, plătește mai târziu”.',
    options: QUIZ.profile.expensiveDebt,
  },
  { key: 'horizon', question: 'Când s-ar putea să ai nevoie de banii pe care îi pui deoparte?', options: QUIZ.profile.horizon },
] as const;

const TOTAL = QUIZ.knowledge.length + PROFILE_STEPS.length + 1;

/** The onboarding quiz: 6 knowledge questions, 5 about you, then optional numbers. About two minutes. */
export function QuizFlow() {
  const [i, setI] = useState(0);
  const [draft, setDraft] = useState<Draft>({ knowledge: [] });
  const [money, setMoney] = useState<Money>({ grossMonthly: '', fuelLei: '', electricityLei: '', savedLei: '' });
  const [result, setResult] = useState<{ profile: Profile; note?: string }>();
  const [busy, setBusy] = useState(false);

  if (result) return <QuizResult profile={result.profile} note={result.note} />;

  const k = QUIZ.knowledge.length;
  const isKnowledge = i < k;
  const profileStep = !isKnowledge && i < k + PROFILE_STEPS.length ? PROFILE_STEPS[i - k] : undefined;
  const current: unknown = isKnowledge ? draft.knowledge[i] : profileStep ? draft[profileStep.key] : true;
  const canGoOn = current !== undefined;

  async function finish(skipMoney = false) {
    setBusy(true);
    const num = (s: string) => (skipMoney || s.trim() === '' ? undefined : Math.max(0, Number(s)) || 0);
    const answers: QuizAnswers = {
      knowledge: draft.knowledge.map((a) => a ?? 'nu_stiu'),
      ageBand: draft.ageBand as AgeBand,
      situation: draft.situation as Situation,
      bufferMonths: draft.bufferMonths as number,
      expensiveDebt: draft.expensiveDebt as boolean,
      horizon: draft.horizon as MoneyHorizon,
      grossMonthly: num(money.grossMonthly),
      fuelLei: num(money.fuelLei),
      electricityLei: num(money.electricityLei),
      savedLei: num(money.savedLei),
    };
    let note: string | undefined;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ situations: [answers.situation], grossMonthly: answers.grossMonthly }),
      });
      if (!res.ok) throw new Error(res.statusText);
    } catch {
      note = 'Momentele declanșate vor apărea când serverul e disponibil.';
    }
    const profile = await saveQuiz(answers);
    setResult({ profile, note });
  }

  const next = () => (i === TOTAL - 1 ? finish() : setI(i + 1));

  return (
    <div className="stack-lg">
      <header className="stack" style={{ gap: 8 }}>
        <div className="row">
          {i === 0 ? (
            <Link href="/" className="link-back">
              <Icon name="back" size={18} /> Înapoi
            </Link>
          ) : (
            <button type="button" className="link-back" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => setI(i - 1)}>
              <Icon name="back" size={18} /> Înapoi
            </button>
          )}
          <span className="small muted">
            Întrebarea {i + 1} din {TOTAL}
          </span>
        </div>
        <ProgressBar value={i + 1} max={TOTAL} label={`Întrebarea ${i + 1} din ${TOTAL}`} />
      </header>

      {isKnowledge && (
        <QuizStep<KnowledgeAnswer>
          key={i}
          eyebrow="Ce știi deja"
          question={QUIZ.knowledge[i].question}
          options={[...QUIZ.knowledge[i].options.map((label, value) => ({ value, label })), NU_STIU]}
          value={draft.knowledge[i]}
          onChange={(v) => setDraft((d) => ({ ...d, knowledge: Object.assign([...d.knowledge], { [i]: v }) }))}
        />
      )}

      {profileStep && (
        <QuizStep<unknown>
          key={i}
          eyebrow="Despre tine"
          question={profileStep.question}
          hint={'hint' in profileStep ? profileStep.hint : undefined}
          options={profileStep.options as readonly QuizOption<unknown>[] as QuizOption<unknown>[]}
          value={draft[profileStep.key]}
          onChange={(v) => setDraft((d) => ({ ...d, [profileStep.key]: v }))}
        />
      )}

      {i === TOTAL - 1 && (
        <div className="stack-lg rise">
          <span className="eyebrow">Opțional</span>
          <h1 style={{ fontSize: 26 }}>Câteva cifre, ca lecțiile și știrile să fie despre tine</h1>
          <p className="muted small">Completează doar ce vrei. Rămân la Rost și nu le dăm nimănui.</p>
          <div className="card">
            <MoneyField label="Salariul brut pe lună" value={money.grossMonthly} onChange={(v) => setMoney({ ...money, grossMonthly: v })} placeholder="ex. 6.000" />
            <MoneyField label="Cât dai pe carburant pe lună" value={money.fuelLei} onChange={(v) => setMoney({ ...money, fuelLei: v })} placeholder="ex. 400" />
            <MoneyField label="Cât dai pe curent pe lună" value={money.electricityLei} onChange={(v) => setMoney({ ...money, electricityLei: v })} placeholder="ex. 150" />
            <MoneyField label="Cât ai pus deoparte" value={money.savedLei} onChange={(v) => setMoney({ ...money, savedLei: v })} placeholder="ex. 2.500" />
          </div>
        </div>
      )}

      <div className="stack">
        <button type="button" className="btn btn-primary btn-block" disabled={!canGoOn || busy} onClick={next}>
          {i === TOTAL - 1 ? (busy ? 'Calculăm…' : 'Vezi rezultatul') : 'Continuă'}
        </button>
        {i === TOTAL - 1 && (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            disabled={busy}
            onClick={() => finish(true)}
          >
            Sari peste
          </button>
        )}
      </div>
    </div>
  );
}

function MoneyField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label>
      {label}
      <span style={{ position: 'relative' }}>
        <input type="number" inputMode="numeric" min={0} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ paddingRight: 48 }} />
        <span className="muted small" style={{ position: 'absolute', right: 14, top: 15 }}>
          lei
        </span>
      </span>
    </label>
  );
}
