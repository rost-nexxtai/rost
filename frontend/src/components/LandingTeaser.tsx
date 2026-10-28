'use client';

import { useState } from 'react';

const OPTIONS = ['300 lei', '900 lei', '1.500 lei'];
const RIGHT = 2;

/** A one-tap taste of a moment, right on the landing page: guess, then see. */
export function LandingTeaser() {
  const [picked, setPicked] = useState<number>();
  const done = picked !== undefined;
  return (
    <section className="play" aria-label="Încearcă">
      <span className="lesson-kicker">Ghicește</span>
      <strong style={{ fontSize: 19, lineHeight: 1.3 }}>Din 6.000 lei salariu brut, cât merge lunar la pensia ta?</strong>
      <div className="tiles-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {OPTIONS.map((o, i) => (
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
          <strong>{picked === RIGHT ? 'Exact.' : 'Mai mult: 1.500 lei.'}</strong> Un sfert din brut. Din ei, 285 lei ajung în contul tău de Pilon II, care e
          al tău și se moștenește. Așa arată fiecare lecție: ghicești, apoi vezi cifrele.
        </p>
      )}
    </section>
  );
}
