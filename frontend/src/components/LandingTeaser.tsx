'use client';

import { useState } from 'react';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    guess: 'Ghicește',
    question: 'Din 6.000 lei salariu brut, cât merge lunar la pensia ta?',
    options: ['300 lei', '900 lei', '1.500 lei'],
    right: 'Exact.',
    wrong: 'Mai mult: 1.500 lei.',
    after: 'Un sfert din brut. Din ei, 285 lei ajung în contul tău de Pilon II, care e al tău și se moștenește. Așa arată fiecare lecție: ghicești, apoi vezi cifrele.',
    aria: 'Încearcă',
  },
  {
    guess: 'Guess',
    question: 'From a 6,000 lei gross salary, how much goes to your pension each month?',
    options: ['300 lei', '900 lei', '1,500 lei'],
    right: 'Exactly.',
    wrong: 'More: 1,500 lei.',
    after: "A quarter of gross. Of that, 285 lei lands in your own Pillar II account, which is yours and can be inherited. Every lesson works like this: guess, then see the numbers.",
    aria: 'Try it',
  },
);

const RIGHT = 2;

/** A one-tap taste of a moment, right on the landing page: guess, then see. */
export function LandingTeaser() {
  const [picked, setPicked] = useState<number>();
  const done = picked !== undefined;
  const t = T[useLang().lang];
  return (
    <section className="play" aria-label={t.aria}>
      <strong style={{ fontSize: 19, lineHeight: 1.3 }}>{t.question}</strong>
      <span className="lesson-hint" style={{ marginTop: -10 }}>{t.guess}</span>
      <div className="tiles-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {t.options.map((o, i) => (
          <button
            key={o}
            type="button"
            className="tile"
            style={{ minHeight: 52, padding: 8 }}
            disabled={done}
            data-state={!done ? undefined : i === RIGHT ? 'correct' : i === picked ? 'wrong' : 'dim'}
            onClick={() => setPicked(i)}
          >
            {o}
          </button>
        ))}
      </div>
      {done && (
        <p className="small rise" role="status">
          <strong>{picked === RIGHT ? t.right : t.wrong}</strong> {t.after}
        </p>
      )}
    </section>
  );
}
