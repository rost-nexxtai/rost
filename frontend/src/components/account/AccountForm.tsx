'use client';

import { useId, useState } from 'react';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    email: 'Email',
    password: 'Parolă',
    passwordHint: 'Cel puțin 8 caractere.',
    errors: {
      invalid_email: 'Scrie o adresă de email validă.',
      weak_password: 'Parola trebuie să aibă cel puțin 8 caractere.',
      email_taken: 'Există deja un cont cu acest email. Îl deschizi din „Am deja cont”, pe prima pagină.',
      account_saved: 'Contul tău e deja salvat.',
      demo_account: 'Contul demo nu se poate salva.',
      bad_login: 'Email sau parolă greșită.',
      too_many_tries: 'Prea multe încercări. Mai încearcă peste câteva minute.',
      down: 'Serverul nu răspunde acum. Mai încearcă o dată.',
    },
  },
  {
    email: 'Email',
    password: 'Password',
    passwordHint: 'At least 8 characters.',
    errors: {
      invalid_email: 'Enter a valid email address.',
      weak_password: 'The password needs at least 8 characters.',
      email_taken: 'There is already an account with this email. Open it from “I have an account” on the first page.',
      account_saved: 'Your account is already saved.',
      demo_account: "The demo account can't be saved.",
      bad_login: 'Wrong email or password.',
      too_many_tries: 'Too many tries. Try again in a few minutes.',
      down: "The server isn't answering right now. Try again.",
    },
  },
);

export type AccountError = keyof (typeof T)['ro']['errors'];

/** Sends email and password to the API; the answer's error code becomes a sentence. */
export async function postAccount(path: '/api/auth/register' | '/api/auth/login', email: string, password: string): Promise<AccountError | undefined> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (res.ok) return undefined;
    if (res.status === 429) return 'too_many_tries';
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    return error && error in T.ro.errors ? (error as AccountError) : 'down';
  } catch {
    return 'down';
  }
}

/** Email and password fields, with the error under them. A new password asks the browser to suggest one. */
export function AccountFields({
  email,
  password,
  onEmail,
  onPassword,
  error,
  newPassword,
}: {
  email: string;
  password: string;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  error?: AccountError;
  newPassword?: boolean;
}) {
  const t = T[useLang().lang];
  const id = useId();
  return (
    <div className="stack" style={{ gap: 14 }}>
      <label className="stack" style={{ gap: 6 }} htmlFor={`${id}-email`}>
        <span className="small muted">{t.email}</span>
        <input
          id={`${id}-email`}
          className="input"
          type="email"
          inputMode="email"
          autoComplete={newPassword ? 'email' : 'username'}
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          aria-invalid={error === 'invalid_email' || error === 'email_taken' || undefined}
        />
      </label>
      <label className="stack" style={{ gap: 6 }} htmlFor={`${id}-password`}>
        <span className="small muted">{t.password}</span>
        <input
          id={`${id}-password`}
          className="input"
          type="password"
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          minLength={newPassword ? 8 : undefined}
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          aria-invalid={error === 'weak_password' || error === 'bad_login' || undefined}
        />
        {newPassword && <span className="note">{t.passwordHint}</span>}
      </label>
      {error && (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {t.errors[error]}
        </p>
      )}
    </div>
  );
}
