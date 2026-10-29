import { describe, expect, it } from 'vitest';
import { forwardedHeaders, hasSessionCookie, importSettled, isHttps, sessionFromSetCookie, withSession } from './session';

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

  it('knows https from the proxy in front, or the URL', () => {
    const h = (proto?: string) => new Headers(proto ? { 'x-forwarded-proto': proto } : {});
    expect(isHttps(h('https'), 'http://web:3000/acasa')).toBe(true);
    expect(isHttps(h('http'), 'https://rost.ro/acasa')).toBe(false);
    expect(isHttps(h('https, http'), 'http://web:3000/')).toBe(true);
    expect(isHttps(h(), 'https://rost.ro/')).toBe(true);
    expect(isHttps(h(), 'http://localhost:3000/')).toBe(false);
  });

  it('passes on X-Forwarded-For only when there is one', () => {
    expect(forwardedHeaders(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.2' }))).toEqual({ 'x-forwarded-for': '203.0.113.7, 10.0.0.2' });
    expect(forwardedHeaders(new Headers())).toEqual({});
  });

  it('drops the old profile once imported or when there is nothing to import', () => {
    expect([200, 400, 409].every(importSettled)).toBe(true);
    expect([401, 429, 500, 502].some(importSettled)).toBe(false);
  });
});
