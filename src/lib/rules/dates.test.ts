import { describe, expect, it } from 'vitest';
import { addMonths, daysBetween, pillar2Deadline } from './dates';

describe('dates', () => {
  it('Pillar II deadline: hired 1 Sep 2026 -> choose by 31 Dec 2026', () => {
    expect(pillar2Deadline('2026-09-01')).toBe('2026-12-31');
  });

  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-10-31', 4)).toBe('2027-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-12-01', '2026-12-31')).toBe(30);
  });
});
