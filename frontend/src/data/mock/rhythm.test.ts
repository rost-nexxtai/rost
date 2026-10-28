import { describe, expect, it } from 'vitest';
import { dayBefore, dayKey, validDays, weekOf, withDay } from './rhythm';

describe('days', () => {
  it('uses the Romanian calendar day', () => {
    // 23:30 UTC on 28 Oct is already 29 Oct in Bucharest (UTC+2)
    expect(dayKey(new Date('2026-10-28T23:30:00Z'))).toBe('2026-10-29');
    expect(dayKey(new Date('2026-10-28T21:30:00Z'))).toBe('2026-10-28');
  });

  it('steps back across months and years', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
    expect(dayBefore('2026-10-29', 3)).toBe('2026-10-26');
  });
});

describe('this week', () => {
  it('records a day once and keeps two weeks', () => {
    expect(withDay(withDay(undefined, '2026-10-26'), '2026-10-26')).toEqual(['2026-10-26']);
    const many = Array.from({ length: 20 }, (_, i) => dayBefore('2026-10-28', 20 - i));
    expect(withDay(many, '2026-10-28')).toHaveLength(14);
    expect(withDay(many, '2026-10-28').at(-1)).toBe('2026-10-28');
  });

  it('runs Monday to Sunday, with the days a lesson was finished', () => {
    // 28 Oct 2026 is a Wednesday
    const week = weekOf(['2026-10-20', '2026-10-26', '2026-10-28'], '2026-10-28');
    expect(week.map((d) => d.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(week.map((d) => d.active)).toEqual([true, false, true, false, false, false, false]);
    expect(week.findIndex((d) => d.today)).toBe(2);
    expect(week.filter((d) => d.future)).toHaveLength(4);
  });

  it('rejects a hand-edited list', () => {
    expect(validDays(['2026-10-28'])).toBe(true);
    expect(validDays(['yesterday'])).toBe(false);
    expect(validDays('2026-10-28')).toBe(false);
  });
});
