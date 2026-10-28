// MOCK until backend ships GET /api/stiri (the rules engine owns the real formulas).
import type { Lang } from '@/i18n/lang';
import { newsFor } from '../fixtures/en';
import type { MoneyLine, MoneyLines, NewsItem, Profile, StiriResponse } from '../types';

/** Your monthly spend in the category × the shock on the slider. */
export function spendImpactLei(spendLei: number, pct: number): number {
  return Math.round((spendLei * pct) / 100);
}

/** What a year of inflation does to savings: amount × ((1 + rate) ÷ (1 + inflation) − 1). Negative is a loss. */
export function savingsLossLei(savedLei: number, inflationPct: number, ratePct = 0): number {
  return Math.round(savedLei * ((1 + ratePct / 100) / (1 + inflationPct / 100) - 1));
}

function monthlyLei(item: NewsItem, p: Profile): number {
  if (item.impact.kind === 'spend') return spendImpactLei(p.money[item.impact.line], item.impact.shock.defaultPct);
  return Math.abs(savingsLossLei(p.money.savedLei, p.money.inflationPct)) / 12;
}

/** The three items, biggest effect on this user's money first. */
export function buildStiri(p: Profile, lang: Lang = 'ro'): StiriResponse {
  const items = newsFor(lang).map((n) => ({ ...n, monthlyLei: monthlyLei(n, p) }))
    .map((n, i) => ({ n, i }))
    .sort((a, b) => b.n.monthlyLei - a.n.monthlyLei || a.i - b.i)
    .map(({ n }) => n);
  return { items, money: p.money };
}

/** Ask for an amount only when the user hasn't given one: a known 0 is an answer. */
export function needsAmount(money: MoneyLines, line: MoneyLine): boolean {
  return money[line] <= 0 && !money.known?.includes(line);
}
