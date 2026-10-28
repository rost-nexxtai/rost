import { describe, expect, it } from 'vitest';
import { lei, leiSigned, pct } from './format';

describe('Romanian money formatting', () => {
  it('groups thousands with a dot and rounds to whole lei', () => {
    expect(lei(1500)).toBe('1.500 lei');
    expect(lei(32.4)).toBe('32 lei');
  });

  it('uses a decimal comma for percentages', () => {
    expect(pct(8.4812, 2)).toBe('8,48%');
  });

  it('signs impacts with plus and a true minus', () => {
    expect(leiSigned(32)).toBe('+32 lei');
    expect(leiSigned(-195.4)).toBe('−195 lei');
    expect(leiSigned(0)).toBe('0 lei');
  });
});
