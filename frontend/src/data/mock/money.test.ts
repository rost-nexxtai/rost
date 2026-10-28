import { describe, expect, it } from 'vitest';
import { PERSONAS } from '../fixtures/personas';
import { DEFAULT_EXPENSES_LEI, fundStart, updateMeBody, withMyMoney, type MyMoney } from './money';
import { parseProfile } from './profile';
import { NATIONAL_INFLATION_PCT, quizProfile } from './scoring';

const fresh = quizProfile({ knowledge: [0, 0], ageBand: 'sub_25', situation: 'employed', bufferMonths: 1, expensiveDebt: false }, undefined, { retake: false });
const maria = PERSONAS.maria;

describe('your money', () => {
  it('keeps what you typed and forgets what you cleared', () => {
    const m: MyMoney = { situation: 'employed', expensesLei: 3000, savedLei: 4000, fuelLei: 0 };
    const p = withMyMoney(maria, m);
    expect(p.money.expensesLei).toBe(3000);
    expect(p.money.savedLei).toBe(4000);
    expect(p.money.fuelLei).toBe(0); // "I don't drive" is an answer
    expect(p.money.known).toEqual(['fuelLei', 'savedLei']);
    expect(p.money.electricityLei).toBe(0); // cleared: back to "ask me"
  });

  it('takes the inflation the backend worked out, and says whether it is yours', () => {
    expect(withMyMoney(fresh, { situation: 'employed' }, { pct: 8.1, personal: true }).money).toMatchObject({ inflationPct: 8.1, inflationPersonal: true });
    expect(withMyMoney(fresh, { situation: 'employed' }).money.inflationPct).toBe(NATIONAL_INFLATION_PCT);
  });

  it('changes the situation, and the saved cookie still parses', () => {
    const p = withMyMoney(fresh, { situation: 'between_jobs', expensesLei: 2200 });
    expect(p.situation).toBe('between_jobs');
    expect(parseProfile(JSON.stringify(p))).toEqual(p);
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
    const mine = withMyMoney(fresh, { situation: 'employed', expensesLei: 3000, savedLei: 1000 });
    expect(fundStart(mine)).toEqual({ spendLei: 3000, haveLei: 1000, yours: true });
    // expenses given, savings not: the months from the quiz times your own spending
    expect(fundStart(withMyMoney(fresh, { situation: 'employed', expensesLei: 3000 }))).toEqual({ spendLei: 3000, haveLei: 3000, yours: true });
    expect(fundStart(undefined)).toEqual({ spendLei: DEFAULT_EXPENSES_LEI, haveLei: 0, yours: false });
  });
});
