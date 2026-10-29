import { describe, expect, it } from 'vitest';
import type { Profile } from '../types';
import { DEFAULT_EXPENSES_LEI, fundStart, updateMeBody } from './money';
import { profileFromQuiz } from './scoring';

const fresh = profileFromQuiz({ knowledge: [0, 0], ageBand: 'sub_25', situation: 'employed', bufferMonths: 1, expensiveDebt: false });
const withMoney = (p: Profile, money: Partial<Profile['money']>): Profile => ({ ...p, money: { ...p.money, ...money } });

describe('your money', () => {
  it('sends every money line: a number sets it, a blank forgets it', () => {
    expect(updateMeBody({ situation: 'employed', savedLei: 4000.4, fuelLei: 0 }).moneyLines).toEqual({ fuelLei: 0, electricityLei: null, savedLei: 4000 });
  });

  it('asks the backend to forget the salary when there is none any more', () => {
    expect(updateMeBody({ situation: 'between_jobs' })).toMatchObject({ situations: ['between_jobs'], noSalary: true });
    expect(updateMeBody({ situation: 'employed', grossMonthly: 6000 }).noSalary).toBe(false);
    expect(updateMeBody({ situation: 'employed' }).noSalary).toBe(true);
  });

  it('clears blank dates and amounts with 0 or ""', () => {
    expect(updateMeBody({ situation: 'employed', grossMonthly: 6000 })).toMatchObject({ payday: 0, hireDate: '', monthlyExpenses: 0 });
    expect(updateMeBody({ situation: 'employed', grossMonthly: 6000, payday: 10, hireDate: '2026-09-01', expensesLei: 2800 })).toMatchObject({
      payday: 10,
      hireDate: '2026-09-01',
      monthlyExpenses: 2800,
    });
  });

  it('sends a spending mix only when there is one', () => {
    expect(updateMeBody({ situation: 'employed' }).spendingShares).toBeUndefined();
    expect(updateMeBody({ situation: 'employed', shares: { services: 50, nonFood: 25, food: 25 } }).spendingShares).toEqual({ services: 50, nonFood: 25, food: 25 });
  });

  it('starts the emergency-fund calculator from your numbers, or says it used defaults', () => {
    expect(fundStart(fresh)).toEqual({ spendLei: DEFAULT_EXPENSES_LEI, haveLei: DEFAULT_EXPENSES_LEI, yours: false });
    const mine = withMoney(fresh, { expensesLei: 3000, savedLei: 1000, known: ['savedLei'] });
    expect(fundStart(mine)).toEqual({ spendLei: 3000, haveLei: 1000, yours: true });
    // expenses given, savings not: the months from the quiz times your own spending
    expect(fundStart(withMoney(fresh, { expensesLei: 3000 }))).toEqual({ spendLei: 3000, haveLei: 3000, yours: true });
    expect(fundStart(undefined)).toEqual({ spendLei: DEFAULT_EXPENSES_LEI, haveLei: 0, yours: false });
  });
});
