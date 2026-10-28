/**
 * Browser calls to /api/admin/*. The admin cookie is scoped to /api/admin and SameSite=Strict,
 * so these run from the browser on this origin (Next proxies them to the Go API), never from the server.
 */
export interface AdminResult<T> {
  ok: boolean;
  status: number;
  data: Partial<T> & { error?: string };
}

export type AdminCall = <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<AdminResult<T>>;

export const adminFetch: AdminCall = async (path, init) => {
  const hasBody = init?.body !== undefined;
  const res = await fetch(`/api/admin${path}`, {
    method: init?.method ?? 'GET',
    headers: hasBody ? { 'content-type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  return { ok: res.ok, status: res.status, data };
};
