'use client';

import type { PayslipBreakdown } from '@/contract';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    parts: { pension: 'Pensie (CAS, 25%)', health: 'Sănătate (CASS, 10%)', incomeTax: 'Impozit pe venit (10%)', net: 'Salariul net, în mână' },
    youSaid: 'Tu ai zis',
    actually: 'De fapt,',
    gross: (amount: string) => `Salariul tău brut de ${amount}`,
    split: 'Salariul brut împărțit în pensie, sănătate, impozit și net',
    pension: (pension: string, pillar2: string, rest: string) => [
      `${pension} merg lunar la sistemul de pensii. Din ei, `,
      `${pillar2} ajung în contul tău de Pilon II`,
      `: sunt ai tăi și se moștenesc. Restul de ${rest} plătesc pensiile de azi și îți aduc puncte de pensie.`,
    ],
    deduction: (year: number) => `Deducerea personală nu e aplicată încă, așa că pe fluturașul real impozitul poate fi puțin mai mic. Reguli ${year}.`,
  },
  {
    parts: { pension: 'Pension (CAS, 25%)', health: 'Health (CASS, 10%)', incomeTax: 'Income tax (10%)', net: 'Net pay, in your hand' },
    youSaid: 'You said',
    actually: 'Actually,',
    gross: (amount) => `Your gross salary of ${amount}`,
    split: 'Gross salary split into pension, health, tax and net pay',
    pension: (pension, pillar2, rest) => [
      `${pension} a month goes to the pension system. Of that, `,
      `${pillar2} lands in your own Pillar II account`,
      `: it's yours and can be inherited. The other ${rest} pays today's pensions and earns you pension points.`,
    ],
    deduction: (year) => `The personal deduction isn't applied yet, so on your real payslip the tax may be a little lower. ${year} rules.`,
  },
);

const PARTS = [
  { key: 'pension', color: 'var(--accent)' },
  { key: 'health', color: 'var(--muted)' },
  { key: 'incomeTax', color: 'var(--line-strong)' },
  { key: 'net', color: 'var(--primary)' },
] as const;

/** Where a gross salary goes. Numbers come from the backend rules; nothing is recomputed here. */
export function PayslipReveal({ p, guess }: { p: PayslipBreakdown & { pillar2Deadline?: string }; guess?: number }) {
  const { lang, f } = useLang();
  const t = T[lang];
  const [before, bold, after] = t.pension(f.lei(p.pension), f.lei(p.pillar2), f.lei(p.publicPension));
  return (
    <div className="stack" style={{ gap: 14 }}>
      {guess !== undefined && (
        <p className="muted">
          {t.youSaid} {f.lei(guess)}. {t.actually} <strong style={{ color: 'var(--ink)' }}>{f.lei(p.pension)}</strong>.
        </p>
      )}
      <div className="card">
        <span className="eyebrow">{t.gross(f.lei(p.gross))}</span>
        <div className="stackbar" role="img" aria-label={t.split}>
          {PARTS.map((part) => (
            <div key={part.key} style={{ flex: p[part.key], background: part.color }} />
          ))}
        </div>
        {PARTS.map((part) => (
          <div key={part.key} className="row">
            <span className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <span className="swatch" style={{ background: part.color }} />
              {t.parts[part.key]}
            </span>
            <strong>{f.lei(p[part.key])}</strong>
          </div>
        ))}
      </div>

      <div className="card card-tint">
        <p>
          {before}
          <strong>{bold}</strong>
          {after}
        </p>
      </div>
      {p.personalDeduction === 0 && <p className="note">{t.deduction(p.rulesYear)}</p>}
    </div>
  );
}
