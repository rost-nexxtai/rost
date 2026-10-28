// The user's own numbers (Profil → "Banii tăi"). The backend keeps what drives triggers and personal
// inflation (PATCH /api/me); the profile cookie keeps the lines the screens read.
import type { CategoryShares, UpdateMeRequest } from '@/contract';
import type { MoneyLine, Profile, Situation } from '../types';
import { NATIONAL_INFLATION_PCT } from './scoring';

/** What we assume someone under 30 spends a month when they haven't told us. Always labelled as assumed. */
export const DEFAULT_EXPENSES_LEI = 2500;

/** Everything the editor asks. A missing field means "not said": we fall back to a default and say so. */
export interface MyMoney {
  situation: Situation;
  grossMonthly?: number;
  payday?: number;
  hireDate?: string;
  expensesLei?: number;
  savedLei?: number;
  fuelLei?: number;
  electricityLei?: number;
  shares?: CategoryShares;
}

const LINES: MoneyLine[] = ['fuelLei', 'electricityLei', 'savedLei'];

/** The profile after the user edits their numbers, with the inflation the backend worked out (if it answered). */
export function withMyMoney(p: Profile, m: MyMoney, inflation?: { pct: number; personal: boolean }): Profile {
  const money = { ...p.money };
  for (const line of LINES) money[line] = Math.max(0, Math.round(m[line] ?? 0));
  money.known = LINES.filter((line) => m[line] !== undefined);
  if (m.expensesLei && m.expensesLei > 0) money.expensesLei = Math.round(m.expensesLei);
  else delete money.expensesLei;
  money.inflationPct = inflation?.pct ?? (money.inflationPersonal ? money.inflationPct : NATIONAL_INFLATION_PCT);
  money.inflationPersonal = inflation ? inflation.personal : money.inflationPersonal;
  return { ...p, situation: m.situation, money };
}

/** The PATCH /api/me body: blanks are sent as 0 or "" so they clear, and no salary unless employed with one. */
export function updateMeBody(m: MyMoney): UpdateMeRequest {
  return {
    situations: [m.situation],
    noSalary: !(m.situation === 'employed' && m.grossMonthly),
    payday: m.payday ?? 0,
    hireDate: m.hireDate ?? '',
    monthlyExpenses: m.expensesLei ?? 0,
    ...(m.shares && { spendingShares: m.shares }),
  };
}

export interface FundStart {
  spendLei: number;
  haveLei: number;
  yours: boolean;
}

/**
 * Where the emergency-fund calculator starts: your spending and savings, or the default spending
 * times the months you said at onboarding. `yours` is false when it's all assumed.
 */
export function fundStart(p: Profile | undefined): FundStart {
  if (!p) return { spendLei: DEFAULT_EXPENSES_LEI, haveLei: 0, yours: false };
  const spendLei = p.money.expensesLei ?? DEFAULT_EXPENSES_LEI;
  const savedKnown = p.money.known?.includes('savedLei');
  return {
    spendLei,
    haveLei: savedKnown ? p.money.savedLei : spendLei * p.bufferMonths,
    yours: p.money.expensesLei !== undefined || !!savedKnown,
  };
}
