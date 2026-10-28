import { useState } from 'react';
import { LEVEL_LABEL, QUIZ, levelFromScore, riskFor, type Profile } from './profile';

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [age, setAge] = useState('');
  const [answers, setAnswers] = useState<(number | undefined)[]>(QUIZ.map(() => undefined));
  const [result, setResult] = useState<Profile>();

  const ready = Number(age) >= 14 && answers.every((a) => a !== undefined);

  function finish() {
    const correct = answers.filter((a, i) => a === QUIZ[i].correct).length;
    const level = levelFromScore(correct);
    setResult({ age: Number(age), level, risk: riskFor(Number(age), level), doneMoments: [] });
  }

  if (result) {
    return (
      <main className="shell">
        <h1>Profilul tău</h1>
        <div className="card card-dark">
          <span className="eyebrow">Nivel</span>
          <div className="big">{LEVEL_LABEL[result.level]}</div>
          <p>
            Profil de risc: <strong>{result.risk}</strong>
          </p>
        </div>
        <p className="muted">Îți arătăm instrumentele și lecțiile potrivite pentru tine. Avansezi pe măsură ce termini momente.</p>
        <button className="btn btn-primary" onClick={() => onDone(result)}>
          Continuă
        </button>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="wordmark">
        rost<span>.</span>
      </div>
      <h1>Hai să te cunoaștem</h1>
      <p className="muted">4 întrebări rapide. Nu e un examen, doar ca să știm de unde pornim.</p>

      <label className="card">
        <span className="q">Câți ani ai?</span>
        <input type="number" inputMode="numeric" min={14} max={99} value={age} onChange={(e) => setAge(e.target.value)} />
      </label>

      {QUIZ.map((q, i) => (
        <fieldset key={i} className="card">
          <legend className="q">{q.question}</legend>
          {q.options.map((o, j) => (
            <label key={j} className="option">
              <input
                type="radio"
                name={`q${i}`}
                checked={answers[i] === j}
                onChange={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))}
              />
              {o}
            </label>
          ))}
        </fieldset>
      ))}

      <button className="btn btn-primary" disabled={!ready} onClick={finish}>
        Vezi profilul meu
      </button>
    </main>
  );
}
