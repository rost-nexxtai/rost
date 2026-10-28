/** Risk 1–5 as five short segments, filled in the risk colour of the value. */
export function RiskMeter({ value, showLabel = false }: { value: 1 | 2 | 3 | 4 | 5; showLabel?: boolean }) {
  return (
    <span className="row-start" style={{ gap: 8 }}>
      <span className="risk" role="img" aria-label={`Risc ${value} din 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={i <= value ? { background: `var(--risk-${value})` } : undefined} />
        ))}
      </span>
      {showLabel && <span className="small muted">Risc {value}/5</span>}
    </span>
  );
}
