import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { MeResponse } from '@/contract';
import { DemoLogin } from '@/components/ClientActions';
import { LandingTeaser } from '@/components/LandingTeaser';
import { LangSwitch } from '@/components/ui/LangSwitch';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';
import { getDemoEnabled, getProfile } from '@/data';
import { entryRoute } from '@/data/mock/scoring';
import { apiOrNothing } from '@/lib/api';
import { hasSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

const T = copy(
  {
    title: 'Banii tăi, pe înțelesul tău.',
    sub: 'Lecții de 3 minute, pe salariul tău și pe știrile care îți mișcă banii. Ghicești, vezi cifrele, faci un pas.',
    start: 'Începe · durează un minut',
    note: 'Educație financiară, nu consultanță de investiții. Rost nu îți mută niciodată banii.',
  },
  {
    title: 'Your money, made clear.',
    sub: 'Three-minute lessons on your salary and the news that moves your money. You guess, see the numbers, take one step.',
    start: 'Start · takes a minute',
    note: 'Financial education, not investment advice. Rost never moves your money.',
  },
);

async function hasSession() {
  if (!hasSessionCookie(await cookies())) return false; // no cookie: no need to ask the backend
  try {
    return Boolean(await apiOrNothing<MeResponse>('/api/me'));
  } catch {
    return false; // backend down: show the landing page rather than an error
  }
}

export default async function Home() {
  // backend down: the landing page, as without a session
  const route = entryRoute(await hasSession(), Boolean(await getProfile().catch(() => undefined)));
  if (route !== '/') redirect(route);
  const [lang, demo] = await Promise.all([getLang(), getDemoEnabled()]);
  const t = T[lang];

  return (
    <main className="shell shell-bare">
      <header className="topbar">
        <span className="wordmark">
          rost<span>.</span>
        </span>
        <LangSwitch />
      </header>

      <section className="stack-lg rise" style={{ paddingTop: 20 }}>
        <h1 style={{ fontSize: 40, lineHeight: 1.04, letterSpacing: -1.4 }}>{t.title}</h1>
        <p className="muted" style={{ fontSize: 17 }}>{t.sub}</p>
      </section>

      <LandingTeaser />

      <div className="stack">
        <Link href="/quiz" className="btn btn-primary btn-block">
          {t.start}
        </Link>
        {demo && <DemoLogin />}
      </div>
      <p className="note" style={{ textAlign: 'center' }}>
        {t.note}
      </p>
    </main>
  );
}
