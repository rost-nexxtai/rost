import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

type Call = { url: string; init: RequestInit };

/** Stubs the backend: each path answers with a status and Set-Cookie headers. */
function backend(answers: Record<string, { status: number; setCookie?: string[] } | 'down'>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const a = answers[new URL(url).pathname];
    if (!a || a === 'down') throw new TypeError('fetch failed');
    const headers = new Headers();
    for (const c of a.setCookie ?? []) headers.append('set-cookie', c);
    return new Response('{}', { status: a.status, headers });
  });
  return calls;
}

function page(cookies: Record<string, string>, extra: Record<string, string> = {}) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
  return new NextRequest('http://rost.test/acasa', { headers: { cookie, 'x-forwarded-for': '203.0.113.7', ...extra } });
}

const setCookies = (res: Response) => res.headers.getSetCookie();
const header = (c: Call, name: string) => new Headers(c.init.headers).get(name);
const OLD = JSON.stringify({ quizScore: 2, level: 1, completedMomentIds: ['fondul_urgenta'] });

afterEach(() => vi.unstubAllGlobals());

describe('proxy', () => {
  it('swaps rost_uid for a session, then imports the old profile on it and deletes the cookie', async () => {
    const calls = backend({
      '/api/me': { status: 200, setCookie: ['rost_session=tok; Path=/; Max-Age=7776000; HttpOnly; SameSite=Lax', 'rost_uid=; Path=/; Max-Age=0'] },
      '/api/me/import': { status: 200 },
    });
    const res = await proxy(page({ rost_uid: 'u1', rost_profile: OLD }));
    expect(calls.map((c) => c.url)).toEqual(['http://localhost:8080/api/me', 'http://localhost:8080/api/me/import']);
    const imp = calls[1];
    expect(imp.init.method).toBe('POST');
    expect(imp.init.body).toBe(OLD);
    expect(header(imp, 'cookie')).toBe('rost_session=tok');
    // the backend's rate limits see the browser
    expect(calls.every((c) => header(c, 'x-forwarded-for') === '203.0.113.7')).toBe(true);
    const set = setCookies(res);
    expect(set).toContain('rost_profile=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    expect(set.some((c) => c.startsWith('rost_session=tok;'))).toBe(true);
    // the page renders with the new session
    expect(res.headers.get('x-middleware-request-cookie')).toContain('rost_session=tok');
  });

  it('keeps the cookie when the import should be tried again', async () => {
    for (const status of [429, 500]) {
      backend({ '/api/me/import': { status } });
      const res = await proxy(page({ rost_session: 'tok', rost_renewed: '1', rost_profile: OLD }));
      expect(setCookies(res)).toEqual([]);
    }
    // nothing to import: a bad cookie, or a profile already there
    for (const status of [400, 409]) {
      backend({ '/api/me/import': { status } });
      expect(setCookies(await proxy(page({ rost_session: 'tok', rost_renewed: '1', rost_profile: OLD })))).toEqual([
        'rost_profile=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      ]);
    }
  });

  it('imports without a session too, taking the session the backend makes', async () => {
    const calls = backend({ '/api/me/import': { status: 200, setCookie: ['rost_session=new; Path=/; Max-Age=7776000; HttpOnly; SameSite=Lax'] } });
    const res = await proxy(page({ rost_profile: OLD }));
    expect(header(calls[0], 'cookie')).toBeNull();
    expect(setCookies(res).some((c) => c.startsWith('rost_session=new;'))).toBe(true);
  });

  it("doesn't import while the swap couldn't run, so no second account is made", async () => {
    const calls = backend({ '/api/me': 'down' });
    const res = await proxy(page({ rost_uid: 'u1', rost_profile: OLD }));
    expect(calls).toHaveLength(1);
    expect(setCookies(res)).toEqual([]);
  });

  it('renews the session cookie at most once a day, with the backend attributes', async () => {
    const calls = backend({});
    const res = await proxy(page({ rost_session: 'tok' }, { 'x-forwarded-proto': 'https' }));
    expect(calls).toHaveLength(0);
    expect(setCookies(res)).toEqual([
      'rost_session=tok; Path=/; Max-Age=7776000; HttpOnly; SameSite=Lax; Secure',
      'rost_renewed=1; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax; Secure',
    ]);
    expect(setCookies(await proxy(page({ rost_session: 'tok', rost_renewed: '1' })))).toEqual([]);
    // plain http: not Secure
    expect(setCookies(await proxy(page({ rost_session: 'tok' })))[0]).toBe('rost_session=tok; Path=/; Max-Age=7776000; HttpOnly; SameSite=Lax');
    expect(setCookies(await proxy(page({})))).toEqual([]);
  });
});
