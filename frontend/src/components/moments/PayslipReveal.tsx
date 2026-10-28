import type { PayslipBreakdown } from '@/contract';
import { lei } from '@/lib/format';

const PARTS = [
  { key: 'pension', label: 'Pensie (CAS, 25%)', color: 'var(--accent)' },
  { key: 'health', label: 'Sănătate (CASS, 10%)', color: 'var(--muted)' },
  { key: 'incomeTax', label: 'Impozit pe venit (10%)', color: 'var(--line-strong)' },
  { key: 'net', label: 'Salariul net, în mână', color: 'var(--primary)' },
] as const;

/** Where a gross salary goes. Numbers come from the backend rules (payslip.ts); nothing is recomputed here. */
export function PayslipReveal({ p, guess }: { p: PayslipBreakdown & { pillar2Deadline?: string }; guess?: number }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      {guess !== undefined && (
        <p className="muted">
          Tu ai zis {lei(guess)}. De fapt, <strong style={{ color: 'var(--ink)' }}>{lei(p.pension)}</strong>.
        </p>
      )}
      <div className="card">
        <span className="eyebrow">Salariul tău brut de {lei(p.gross)}</span>
        <div className="stackbar" role="img" aria-label="Salariul brut împărțit în pensie, sănătate, impozit și net">
          {PARTS.map((part) => (
            <div key={part.key} style={{ flex: p[part.key], background: part.color }} />
          ))}
        </div>
        {PARTS.map((part) => (
          <div key={part.key} className="row">
            <span className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <span className="swatch" style={{ background: part.color }} />
              {part.label}
            </span>
            <strong>{lei(p[part.key])}</strong>
          </div>
        ))}
      </div>

      <div className="card card-tint">
        <p>
          <strong>{lei(p.pension)}</strong> merg lunar la sistemul de pensii. Din ei, <strong>{lei(p.pillar2)}</strong> ajung
          în contul tău de Pilon II: sunt <em>ai tăi</em> și se moștenesc. Restul de {lei(p.publicPension)} plătesc pensiile de azi și
          îți aduc puncte de pensie.
        </p>
      </div>
      {p.personalDeduction === 0 && (
        <p className="note">
          Deducerea personală nu e aplicată încă, așa că pe fluturașul real impozitul poate fi puțin mai mic. Reguli {p.rulesYear}.
        </p>
      )}
    </div>
  );
}
