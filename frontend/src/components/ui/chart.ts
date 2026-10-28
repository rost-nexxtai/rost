/** Pure chart maths, kept apart from the SVG so it can be tested without a renderer. */

/** SVG y for a value: 0 sits on the baseline (height), max at the top. An all-zero series stays on the baseline. */
export function scaleY(value: number, max: number, height: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return height;
  return height - Math.min(1, Math.max(0, value / max)) * height;
}

const oneDecimal = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 });

/** Gridline labels: 850, 10 mii, 1,2 mil. */
export function compactLei(n: number): string {
  if (n >= 1_000_000) return `${oneDecimal.format(n / 1_000_000)} mil.`;
  if (n >= 1_000) return `${Math.round(n / 1000)} mii`;
  return String(Math.round(n));
}

/** A round number just above max, so gridlines land on readable values. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= max) return m * step;
  return 10 * step;
}
