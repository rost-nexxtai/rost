import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FollowUp } from '@/components/ClientActions';
import { MomentRow } from '@/components/momente/MomentRow';
import { ApiDown } from '@/components/ui/ApiDown';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { getMomente, getProfile } from '@/data';
import { firstLesson } from '@/data/mock/momente';

export const dynamic = 'force-dynamic';

const ACTION_TEXT: Record<string, string> = {
  payday_savings_rule: 'Ți-ai setat transferul automat de economii de ziua salariului?',
  update_buffer_target: 'Ți-ai actualizat ținta pentru fondul de urgență?',
};

export default async function Momente() {
  const [data, profile] = await Promise.all([getMomente(), getProfile()]);
  if (!data || !profile) redirect('/quiz');
  const { triggered, forYourLevel, rest, progress, realApiDown, dueFollowUps } = data;
  // One obvious next step: a moment the backend opened wins; otherwise the next lesson at your level.
  const first = firstLesson(profile);
  const nextUp = triggered.length === 0 ? [...forYourLevel, ...rest].find((m) => m.id === first?.id && m.status === 'todo') : undefined;
  const listed = forYourLevel.filter((m) => m !== nextUp);

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <h1>Momente</h1>

      <Card>
        <div className="row">
          <span className="eyebrow">Nivelul L{progress.level}</span>
          {progress.nextLevel !== null && (
            <span className="small muted">
              {progress.coreDone} din {progress.coreTotal} lecții de bază
            </span>
          )}
        </div>
        {progress.nextLevel !== null ? (
          <>
            <ProgressBar value={progress.coreDone} max={progress.coreTotal} label={`${progress.coreDone} din ${progress.coreTotal} lecții de bază`} />
            <p className="small">Termină-le ca să treci la L{progress.nextLevel}.</p>
          </>
        ) : (
          <p className="small">Ai ajuns la nivelul avansat.</p>
        )}
      </Card>

      {dueFollowUps.map((a) => <FollowUp key={a.id} actionId={a.id} text={ACTION_TEXT[a.type] ?? 'Ai făcut pasul?'} />)}

      {realApiDown ? (
        <ApiDown what="Momentele declanșate de salariu, inflație sau știri apar aici când revine conexiunea. Lecțiile de mai jos merg oricum." />
      ) : (
        triggered.map((m) => (
          <section key={m.href} className="card card-dark rise">
            <span className="stat-label" style={{ fontSize: 14, fontWeight: 700 }}>Acum, pe cifrele tale · {m.minutes} min</span>
            <h2 style={{ fontSize: 24 }}>{m.title}</h2>
            <Link href={m.href!} className="btn btn-light" style={{ alignSelf: 'flex-start' }}>
              Începe
            </Link>
          </section>
        ))
      )}

      {nextUp && (
        <section className="stat rise" aria-label="Următoarea ta lecție">
          <span className="stat-label" style={{ fontSize: 14, fontWeight: 700 }}>
            Următoarea ta lecție · {nextUp.minutes} min
          </span>
          <div className="display-md" style={{ color: '#fff' }}>
            {nextUp.title}
          </div>
          {nextUp.hook && <span className="stat-label">{nextUp.hook}</span>}
          <Link href={nextUp.href!} className="btn btn-light" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
            Începe
          </Link>
        </section>
      )}

      <section className="section" aria-labelledby="nivel">
        <h2 id="nivel" className="section-title">
          Pentru nivelul tău
        </h2>
        <Card style={{ gap: 0 }}>
          {listed.length ? listed.map((m) => <MomentRow key={m.id} m={m} />) : <p className="small muted">{nextUp ? 'Începe cu lecția de mai sus.' : 'Le-ai terminat pe toate. Bravo!'}</p>}
        </Card>
      </section>

      {rest.length > 0 && (
        <section className="section" aria-labelledby="restul">
          <h2 id="restul" className="section-title">
            Restul
          </h2>
          <Card style={{ gap: 0 }}>
            {rest.map((m) => (
              <MomentRow key={m.id} m={m} />
            ))}
          </Card>
        </section>
      )}
      <TabBar current="momente" />
    </main>
  );
}
