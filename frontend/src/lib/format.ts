const whole = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0, useGrouping: 'always' });

/** 1500 → "1.500 lei" (Romanian grouping, whole lei). */
export const lei = (n: number) => `${whole.format(Math.round(n))} lei`;

/** 32 → "+32 lei", -195.4 → "−195 lei" (true minus sign), 0 → "0 lei". */
export function leiSigned(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '0 lei';
  return `${r > 0 ? '+' : '−'}${lei(Math.abs(r))}`;
}

/** 8.4812 → "8,48%". */
export const pct = (n: number, digits = 1) =>
  `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)}%`;
