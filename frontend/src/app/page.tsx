import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { MeResponse } from '@/contract';
import { DemoLogin } from '@/components/ClientActions';
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

      <section className="stack-lg rise" style={{ paddingTop: 24 }}>
        <span className="eyebrow">Banii tăi, pe înțelesul tău</span>
        <h1 style={{ fontSize: 40, lineHeight: 1.05, letterSpacing: -1.4 }}>Află ce să faci cu banii tăi, pe cifrele tale.</h1>
        <p className="muted" style={{ fontSize: 17 }}>
          Un test de 2 minute îți arată de unde să începi. Apoi lecții scurte, pe salariul tău și pe știrile care îți mișcă banii.
        </p>
      </section>

      <section className="card" aria-label="Ce găsești în Rost">
        <Feature n="1" title="Acasă" body="Unde îți poți ține sau crește banii, în ordinea în care merită să le înveți." />
        <hr className="divider" />
        <Feature n="2" title="Momente" body="Lecții de 5 minute: ghicești, vezi cifrele tale, faci un singur pas." />
        <hr className="divider" />
        <Feature n="3" title="Știri" body="Ce se întâmplă în lume, în lei pe lună pentru tine." />
      </section>

      <div className="stack">
        <Link href="/quiz" className="btn btn-primary btn-block">
          Începe testul
        </Link>
        <DemoLogin />
      </div>
      <p className="note" style={{ textAlign: 'center' }}>
        Educație financiară, nu consultanță de investiții. Rost nu îți mută niciodată banii.
      </p>
    </main>
  );
}

function Feature({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="row-start" style={{ alignItems: 'flex-start', gap: 14 }}>
      <span className="rank" style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}>
        {n}
      </span>
      <div className="stack" style={{ gap: 2 }}>
        <h3>{title}</h3>
        <p className="small muted">{body}</p>
      </div>
    </div>
  );
}
