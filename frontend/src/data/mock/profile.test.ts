import { describe, expect, it } from 'vitest';
import { PERSONAS } from '../fixtures/personas';
import { parseProfile } from './profile';

describe('profile cookie parsing', () => {
  it('treats a missing, corrupt or wrong-shaped cookie as no profile', () => {
    expect(parseProfile(undefined)).toBeUndefined();
    expect(parseProfile('garbage')).toBeUndefined();
    expect(parseProfile(JSON.stringify({ level: 7 }))).toBeUndefined();
  });

  it('reads back a valid profile unchanged', () => {
    expect(parseProfile(JSON.stringify(PERSONAS.maria))).toEqual(PERSONAS.maria);
  });
});
