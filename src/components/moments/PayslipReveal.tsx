import type { PayslipBreakdown } from '@/lib/rules';
import { lei } from '@/lib/format';

const PARTS = [
  { key: 'pension', label: 'Pension (CAS, 25%)', color: 'var(--accent)' },
  { key: 'health', label: 'Health (CASS, 10%)', color: 'var(--grey-bar)' },
  { key: 'incomeTax', label: 'Income tax (10%)', color: '#c9ced6' },
  { key: 'net', label: 'Take-home', color: 'var(--primary)' },
] as const;

/** Where a gross salary goes. Same numbers as src/lib/rules/payslip.ts, nothing recomputed here. */
export function PayslipReveal({ p, guess }: { p: PayslipBreakdown & { pillar2Deadline?: string }; guess?: number }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      {guess !== undefined && (
        <p className="muted">
          You guessed {lei(guess)}. It&apos;s <strong style={{ color: 'var(--ink)' }}>{lei(p.pension)}</strong>.
        </p>
      )}
      <div className="card">
        <span className="eyebrow">Your {lei(p.gross)} gross</span>
        <div className="stackbar" role="img" aria-label="Gross salary split into pension, health, tax and take-home">
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
          <strong>{lei(p.pension)}</strong> goes to the pension system every month. Of that,{' '}
          <strong>{lei(p.pillar2)}</strong> lands in a Pillar II account that is <em>yours</em> and inheritable. The other{' '}
          {lei(p.publicPension)} pays today&apos;s pensions and earns you pension points.
        </p>
      </div>
      {p.personalDeduction === 0 && (
        <p className="note">
          Personal deduction not applied yet, so your real payslip may show a little less tax. Rules {p.rulesYear}.
        </p>
      )}
    </div>
  );
}
