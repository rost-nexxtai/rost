import { describe, expect, it } from 'vitest';
import { compactLei, scaleY } from './chart';

describe('chart scale', () => {
  it('puts every point on the baseline when the series is all zero', () => {
    expect(scaleY(0, 0, 160)).toBe(160);
  });

  it('maps half the max to half the height', () => {
    expect(scaleY(50, 100, 160)).toBe(80);
  });

  it('stays finite for very large values', () => {
    expect(Number.isFinite(scaleY(1e9, 1e9, 160))).toBe(true);
  });

  it('labels gridlines compactly in Romanian', () => {
    expect(compactLei(10000)).toBe('10 mii');
    expect(compactLei(1_200_000)).toBe('1,2 mil.');
    expect(compactLei(850)).toBe('850');
  });
});
