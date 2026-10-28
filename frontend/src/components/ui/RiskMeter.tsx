'use client';

import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy({ aria: (v: number) => `Risc ${v} din 5`, label: (v: number) => `Risc ${v}/5` }, { aria: (v) => `Risk ${v} of 5`, label: (v) => `Risk ${v}/5` });

/** Risk 1–5 as five short segments, filled in the risk colour of the value. */
export function RiskMeter({ value, showLabel = false }: { value: 1 | 2 | 3 | 4 | 5; showLabel?: boolean }) {
  const t = T[useLang().lang];
  return (
    <span className="row-start" style={{ gap: 8 }}>
      <span className="risk" role="img" aria-label={t.aria(value)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={i <= value ? { background: `var(--risk-${value})` } : undefined} />
        ))}
      </span>
      {showLabel && <span className="small muted">{t.label(value)}</span>}
    </span>
  );
}
