'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { AccountFields, postAccount, type AccountError } from './AccountForm';

const T = copy(
  {
    title: 'Intră în cont',
    sub: 'Cu emailul și parola cu care ți-ai salvat contul.',
    login: 'Intră',
    busy: 'Intrăm…',
    noAccount: 'Nu ai cont? Începe testul',
  },
  {
    title: 'Log in',
    sub: 'With the email and password you saved your account with.',
    login: 'Log in',
    busy: 'Logging in…',
    noAccount: 'No account? Start the quiz',
  },
);

/** Email and password for a saved account; this browser then opens it on Acasă. */
export function LoginForm() {
  const router = useRouter();
  const t = T[useLang().lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AccountError>();
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    const problem = await postAccount('/api/auth/login', email, password);
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    router.push('/acasa');
    router.refresh();
  }

  return (
    <form
      className="stack-lg rise"
      style={{ paddingTop: 20 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void login();
      }}
    >
      <div className="stack" style={{ gap: 6 }}>
        <h1>{t.title}</h1>
        <p className="muted">{t.sub}</p>
      </div>
      <AccountFields
        email={email}
        password={password}
        onEmail={(v) => (setEmail(v), setError(undefined))}
        onPassword={(v) => (setPassword(v), setError(undefined))}
        error={error}
      />
      <div className="stack">
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email.trim() || !password}>
          {busy ? t.busy : t.login}
        </button>
        <Link href="/quiz" className="btn-text" style={{ alignSelf: 'center' }}>
          {t.noAccount}
        </Link>
      </div>
    </form>
  );
}
