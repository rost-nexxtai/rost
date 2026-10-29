import { describe, expect, it } from 'vitest';
import { hasSessionCookie, sessionFromSetCookie, withSession } from './session';

describe('session cookie', () => {
  it('counts the session or the old id cookie', () => {
    const jar = (...names: string[]) => ({ has: (n: string) => names.includes(n) });
    expect(hasSessionCookie(jar('rost_session'))).toBe(true);
    expect(hasSessionCookie(jar('rost_uid'))).toBe(true);
    expect(hasSessionCookie(jar('rost_lang'))).toBe(false);
  });

  it('reads the token the backend set, not a cleared cookie', () => {
    expect(
      sessionFromSetCookie(['rost_uid=; Path=/; Max-Age=0', 'rost_session=abc-_123; Path=/; Max-Age=7776000; HttpOnly; SameSite=Lax']),
    ).toBe('abc-_123');
    expect(sessionFromSetCookie(['rost_session=; Path=/; Max-Age=0'])).toBeUndefined();
    expect(sessionFromSetCookie([])).toBeUndefined();
  });

  it('swaps the old cookie for the session and keeps the others', () => {
    const cookies = [
      { name: 'rost_lang', value: 'en' },
      { name: 'rost_uid', value: 'maria' },
    ];
    expect(withSession(cookies, 'tok')).toBe('rost_lang=en; rost_session=tok');
  });
});
