'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Admin } from '@/contract';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import type { AdminCall } from './api';

const T = copy(
  {
    loading: 'Se încarcă…',
    since: (d: string) => `din ${d}`,
    addTitle: 'Adaugă un admin',
    addSub: 'Orice admin poate adăuga alt admin. Parola are cel puțin 12 caractere; trimite-o pe un canal sigur.',
    email: 'Email',
    password: 'Parolă',
    add: 'Adaugă',
    added: (email: string) => `Am adăugat ${email}.`,
  },
  {
    loading: 'Loading…',
    since: (d) => `since ${d}`,
    addTitle: 'Add an admin',
    addSub: 'Any admin can add another. The password needs at least 12 characters; share it over a safe channel.',
    email: 'Email',
    password: 'Password',
    add: 'Add',
    added: (email) => `Added ${email}.`,
  },
);

/** GET/POST /api/admin/admins: who has access, and adding someone. */
export function AdminsPanel({ call }: { call: AdminCall }) {
  const t = T[useLang().lang];
  const [admins, setAdmins] = useState<Admin[]>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // The email just added; the sentence is built at render time so it follows the language switch.
  const [added, setAdded] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await call<{ admins: Admin[] }>('/admins');
    if (r.ok) setAdmins(r.data.admins ?? []);
    else setError(r.data.error ?? String(r.status));
  }, [call]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAdded('');
    const r = await call<{ admin: Admin }>('/admins', { method: 'POST', body: { email, password } });
    if (!r.ok) return setError(r.data.error ?? String(r.status));
    setAdded(r.data.admin?.email ?? email);
    setEmail('');
    setPassword('');
    load();
  }

  return (
    <div className="stack-lg">
      <section className="card">
        {!admins && <p className="muted">{t.loading}</p>}
        {admins?.map((a) => (
          <div key={a.id} className="row small">
            <span>{a.email}</span>
            <span className="muted">{t.since(a.createdAt.slice(0, 10))}</span>
          </div>
        ))}
      </section>
      <form className="card stack" onSubmit={add}>
        <h2>{t.addTitle}</h2>
        <p className="small muted">{t.addSub}</p>
        <div className="grid2">
          <label>
            {t.email}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            {t.password}
            <input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        {added && <p className="small">{t.added(added)}</p>}
        <button className="btn btn-primary btn-sm">{t.add}</button>
      </form>
    </div>
  );
}
