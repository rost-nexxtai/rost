'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminProvider } from '@/contract';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import type { AdminCall } from './api';

const T = copy(
  {
    loading: 'Se încarcă…',
    sub: 'Bifează băncile și brokerii cu care avem parteneriat. În aplicație apar cu eticheta „Partener”. Ordinea listelor nu se schimbă: un partener nu urcă nicio poziție.',
    banks: 'Bănci',
    brokers: 'Brokeri',
    partner: (name: string) => `${name} e partener`,
  },
  {
    loading: 'Loading…',
    sub: 'Tick the banks and brokers we partner with. In the app they carry a "Partner" label. The order of the lists doesn\'t change: a partner never moves up.',
    banks: 'Banks',
    brokers: 'Brokers',
    partner: (name) => `${name} is a partner`,
  },
);

/** GET/PUT /api/admin/providers: mark real banks and brokers as partners. A label, never a rank. */
export function PartnersPanel({ call }: { call: AdminCall }) {
  const t = T[useLang().lang];
  const [providers, setProviders] = useState<AdminProvider[]>();
  const [saving, setSaving] = useState<string>();
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await call<{ providers: AdminProvider[] }>('/providers');
    if (r.ok) setProviders(r.data.providers ?? []);
    else setError(r.data.error ?? String(r.status));
  }, [call]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(p: AdminProvider) {
    setSaving(p.key);
    setError('');
    const r = await call<{ provider: AdminProvider }>(`/providers/${encodeURIComponent(p.key)}`, { method: 'PUT', body: { partner: !p.partner } });
    setSaving(undefined);
    if (!r.ok) return setError(r.data.error ?? String(r.status));
    setProviders((list) => list?.map((x) => (x.key === p.key ? { ...x, partner: !p.partner } : x)));
  }

  const group = (kind: AdminProvider['kind'], title: string) => (
    <section className="card">
      <h2>{title}</h2>
      {providers
        ?.filter((p) => p.kind === kind)
        .map((p) => (
          <label key={p.key} className="check admin-check">
            <input type="checkbox" checked={p.partner} disabled={saving === p.key} onChange={() => toggle(p)} aria-label={t.partner(p.name)} />
            {p.name}
          </label>
        ))}
    </section>
  );

  return (
    <div className="stack-lg">
      <p className="small muted">{t.sub}</p>
      {error && <p className="error">{error}</p>}
      {!providers && !error && <p className="muted">{t.loading}</p>}
      {providers && (
        <div className="admin-columns">
          {group('bank', t.banks)}
          {group('broker', t.brokers)}
        </div>
      )}
    </div>
  );
}
