'use client';

import { useCallback, useEffect, useState } from 'react';
import { TopBar } from '@/components/ui/TopBar';
import type { Admin } from '@/contract';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { AdminsPanel } from './AdminsPanel';
import { adminFetch, type AdminCall } from './api';
import { ContentPanel } from './ContentPanel';
import { StatsPanel } from './StatsPanel';

type Tab = 'stats' | 'moments' | 'news' | 'admins';
const TABS: Tab[] = ['stats', 'moments', 'news', 'admins'];

const T = copy(
  {
    title: 'Admin',
    loading: 'Se încarcă…',
    loginTitle: 'Intră ca admin',
    loginSub: 'Pentru echipa Rost: lecții, știri și statistici.',
    email: 'Email',
    password: 'Parolă',
    login: 'Intră',
    logout: 'Ieși',
    tabs: { stats: 'Statistici', moments: 'Lecții', news: 'Știri', admins: 'Admini' } as Record<Tab, string>,
  },
  {
    title: 'Admin',
    loading: 'Loading…',
    loginTitle: 'Sign in as admin',
    loginSub: 'For the Rost team: lessons, news and statistics.',
    email: 'Email',
    password: 'Password',
    login: 'Sign in',
    logout: 'Sign out',
    tabs: { stats: 'Statistics', moments: 'Lessons', news: 'News', admins: 'Admins' },
  },
);

/** Admin tasks: sign in, then statistics, lessons, news and admin accounts, all from /api/admin. */
export function AdminApp() {
  const t = T[useLang().lang];
  // undefined while we ask the API, null when signed out.
  const [admin, setAdmin] = useState<Admin | null>();
  const [tab, setTab] = useState<Tab>('stats');

  useEffect(() => {
    adminFetch<{ admin: Admin }>('/me').then((r) => setAdmin(r.ok ? (r.data.admin ?? null) : null));
  }, []);

  // A 401 anywhere means the 12-hour session ran out: back to the sign-in form.
  const call: AdminCall = useCallback(async (path, init) => {
    const r = await adminFetch(path, init);
    if (r.status === 401) setAdmin(null);
    return r;
  }, []);

  async function logout() {
    await adminFetch('/logout', { method: 'POST' });
    setAdmin(null);
  }

  if (admin === undefined) {
    return (
      <main className="shell shell-bare">
        <TopBar />
        <p className="muted">{t.loading}</p>
      </main>
    );
  }
  if (admin === null) return <LoginForm onSignedIn={setAdmin} />;

  return (
    <main className="shell shell-wide shell-bare">
      <TopBar />
      <div className="row">
        <h1>{t.title}</h1>
        <span className="row small muted">
          {admin.email}
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            {t.logout}
          </button>
        </span>
      </div>
      <div className="admin-tabs" role="group" aria-label={t.title}>
        {TABS.map((id) => (
          <button key={id} className="chip" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {t.tabs[id]}
          </button>
        ))}
      </div>
      {tab === 'stats' && <StatsPanel call={call} />}
      {(tab === 'moments' || tab === 'news') && <ContentPanel key={tab} kind={tab} call={call} />}
      {tab === 'admins' && <AdminsPanel call={call} />}
    </main>
  );
}

function LoginForm({ onSignedIn }: { onSignedIn: (a: Admin) => void }) {
  const t = T[useLang().lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await adminFetch<{ admin: Admin }>('/login', { method: 'POST', body: { email, password } });
    setBusy(false);
    if (r.ok && r.data.admin) onSignedIn(r.data.admin);
    else setError(r.data.error ?? String(r.status));
  }

  return (
    <main className="shell shell-bare">
      <TopBar />
      <h1>{t.loginTitle}</h1>
      <p className="muted small">{t.loginSub}</p>
      <form className="card stack" onSubmit={submit}>
        <label>
          {t.email}
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t.password}
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {t.login}
        </button>
      </form>
    </main>
  );
}
