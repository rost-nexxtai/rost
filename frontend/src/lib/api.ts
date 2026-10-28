import 'server-only';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Server-side call to the backend, forwarding the browser's cookies (the session).
 * Client components call `/api/...` on this origin instead; next.config.mjs proxies it.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const cookie = (await cookies()).toString();
  if (cookie) headers.set('cookie', cookie);
  if (init.body) headers.set('content-type', 'application/json');
  const res = await fetch(`${BACKEND_URL}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Like `api`, but a 401/404 becomes `undefined` instead of an error. */
export async function apiOrNothing<T>(path: string, init?: RequestInit): Promise<T | undefined> {
  try {
    return await api<T>(path, init);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return undefined;
    throw e;
  }
}
