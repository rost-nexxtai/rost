'use client';

import { useState } from 'react';
import { LessonBar } from '@/components/lesson/LessonBar';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { AccountFields, postAccount, type AccountError } from './AccountForm';

const T = copy(
  {
    title: 'Salvează-ți progresul',
    kicker: 'Opțional',
    hint: 'Cu un email și o parolă îți deschizi contul de pe orice telefon. Fără ele, rămâne doar în acest browser.',
    save: 'Salvează contul',
    saving: 'Salvăm…',
    guest: 'Continuă fără cont',
  },
  {
    title: 'Save your progress',
    kicker: 'Optional',
    hint: 'With an email and a password you can open your account on any phone. Without them, it stays in this browser only.',
    save: 'Save my account',
    saving: 'Saving…',
    guest: 'Continue without an account',
  },
);

/** Right after the quiz: save the account with an email and a password, or carry on as a guest. */
export function SaveAccountStep({ onDone }: { onDone: () => void }) {
  const t = T[useLang().lang];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AccountError>();
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const problem = await postAccount('/api/auth/register', email, password);
    setBusy(false);
    // already saved (a retake, another tab): nothing left to do here
    if (!problem || problem === 'account_saved') onDone();
    else setError(problem);
  }

  return (
    <main className="onboard">
      <form
        className="onboard-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void save();
        }}
      >
        <h1 className="lesson-q rise">{t.title}</h1>
        <span className="lesson-hint rise">{t.kicker}</span>
        <p className="onboard-hint">{t.hint}</p>
        <AccountFields
          email={email}
          password={password}
          onEmail={(v) => (setEmail(v), setError(undefined))}
          onPassword={(v) => (setPassword(v), setError(undefined))}
          error={error}
          newPassword
        />
        {/* Enter in a field submits; the visible buttons are in the bar */}
        <button type="submit" hidden />
      </form>
      <LessonBar
        label={busy ? t.saving : t.save}
        disabled={busy || !email.trim() || !password}
        onClick={() => void save()}
        secondary={{ label: t.guest, onClick: onDone }}
      />
    </main>
  );
}
