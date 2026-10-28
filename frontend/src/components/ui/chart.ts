/** Pure chart maths, kept apart from the SVG so it can be tested without a renderer. */

/** SVG y for a value: 0 sits on the baseline (height), max at the top. An all-zero series stays on the baseline. */
export function scaleY(value: number, max: number, height: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return height;
  return height - Math.min(1, Math.max(0, value / max)) * height;
}

import type { Lang } from '@/i18n/lang';

/** Gridline labels: 850, 10 mii, 1,2 mil. in Romanian; 850, 10k, 1.2m in English. */
export function compactLei(n: number, lang: Lang = 'ro'): string {
  const oneDecimal = new Intl.NumberFormat(lang === 'ro' ? 'ro-RO' : 'en-GB', { maximumFractionDigits: 1 });
  if (n >= 1_000_000) return lang === 'ro' ? `${oneDecimal.format(n / 1_000_000)} mil.` : `${oneDecimal.format(n / 1_000_000)}m`;
  if (n >= 1_000) return lang === 'ro' ? `${Math.round(n / 1000)} mii` : `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

/** A round number just above max, so gridlines land on readable values. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= max) return m * step;
  return 10 * step;
}
