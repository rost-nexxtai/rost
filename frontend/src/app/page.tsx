import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { MeResponse } from '@/contract';
import { DemoLogin } from '@/components/ClientActions';
import { LandingTeaser } from '@/components/LandingTeaser';
import { getProfile } from '@/data';
import { entryRoute } from '@/data/mock/scoring';
import { apiOrNothing } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function hasSession() {
  try {
    return Boolean(await apiOrNothing<MeResponse>('/api/me'));
  } catch {
    return false; // backend down: show the landing page rather than an error
  }
}

export default async function Home() {
  const route = entryRoute(await hasSession(), Boolean(await getProfile()));
  if (route !== '/') redirect(route);

  return (
    <main className="shell shell-bare">
      <header className="topbar">
        <span className="wordmark">
          rost<span>.</span>
        </span>
      </header>

      <section className="stack-lg rise" style={{ paddingTop: 20 }}>
        <h1 style={{ fontSize: 40, lineHeight: 1.04, letterSpacing: -1.4 }}>Banii tăi, pe înțelesul tău.</h1>
        <p className="muted" style={{ fontSize: 17 }}>Lecții de 3 minute, pe salariul tău și pe știrile care îți mișcă banii. Ghicești, vezi cifrele, faci un pas.</p>
      </section>

      <LandingTeaser />

      <div className="stack">
        <Link href="/quiz" className="btn btn-primary btn-block">
          Începe · durează un minut
        </Link>
        <DemoLogin />
      </div>
      <p className="note" style={{ textAlign: 'center' }}>
        Educație financiară, nu consultanță de investiții. Rost nu îți mută niciodată banii.
      </p>
    </main>
  );
}
