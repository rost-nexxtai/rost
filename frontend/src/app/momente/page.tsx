import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FollowUp } from '@/components/ClientActions';
import { MomentRow } from '@/components/momente/MomentRow';
import { ApiDown } from '@/components/ui/ApiDown';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { getLibrary, getMomente, getProfile } from '@/data';
import { firstLesson } from '@/data/mock/momente';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const T = copy(
  {
    action: {
      payday_savings_rule: 'Ți-ai setat transferul automat de economii de ziua salariului?',
      update_buffer_target: 'Ți-ai actualizat ținta pentru fondul de urgență?',
    } as Record<string, string>,
    didIt: 'Ai făcut pasul?',
    title: 'Momente',
    level: (l: number) => `Nivelul L${l}`,
    core: (done: number, of: number) => `${done} din ${of} lecții de bază`,
    finish: (next: number) => `Termină-le ca să treci la L${next}.`,
    advanced: 'Ai ajuns la nivelul avansat.',
    apiDown: 'Momentele declanșate de salariu, inflație sau știri apar aici când revine conexiunea. Lecțiile de mai jos merg oricum.',
    now: (min: number) => `Acum, pe cifrele tale · ${min} min`,
    start: 'Începe',
    next: (min: number) => `Următoarea ta lecție · ${min} min`,
    resume: (step: number, of: number) => `Ai rămas la pasul ${step} din ${of}`,
    continue: 'Continuă',
    forLevel: 'Pentru nivelul tău',
    startAbove: 'Începe cu lecția de mai sus.',
    allDone: 'Le-ai terminat pe toate. Bravo!',
    rest: 'Restul',
    nextAria: 'Următoarea ta lecție',
  },
  {
    action: {
      payday_savings_rule: 'Did you set up the automatic payday transfer to savings?',
      update_buffer_target: 'Did you update your emergency fund target?',
    },
    didIt: 'Did you take the step?',
    title: 'Moments',
    level: (l) => `Level L${l}`,
    core: (done, of) => `${done} of ${of} core lessons`,
    finish: (next) => `Finish them to move up to L${next}.`,
    advanced: "You've reached the advanced level.",
    apiDown: 'Moments triggered by your salary, inflation or the news show up here once the connection is back. The lessons below work anyway.',
    now: (min) => `Now, on your numbers · ${min} min`,
    start: 'Start',
    next: (min) => `Your next lesson · ${min} min`,
    resume: (step, of) => `You stopped at step ${step} of ${of}`,
    continue: 'Continue',
    forLevel: 'For your level',
    startAbove: 'Start with the lesson above.',
    allDone: "You've done them all. Well done!",
    rest: 'Everything else',
    nextAria: 'Your next lesson',
  },
);

export default async function Momente() {
  const [data, profile, lang, library] = await Promise.all([getMomente(), getProfile(), getLang(), getLibrary()]);
  const t = T[lang];
  if (!data || !profile) redirect('/quiz');
  const { triggered, forYourLevel, rest, progress, realApiDown, dueFollowUps } = data;
  // One obvious next step: a moment the backend opened wins; then a lesson left halfway; otherwise the next lesson at your level.
  const first = firstLesson(profile, library);
  const all = [...forYourLevel, ...rest];
  const nextUp = triggered.length === 0 ? (all.find((m) => m.status === 'started') ?? all.find((m) => m.id === first?.id && m.status === 'todo')) : undefined;
  const listed = forYourLevel.filter((m) => m !== nextUp);

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <h1>{t.title}</h1>

      <Card>
        <div className="row">
          <span className="eyebrow">{t.level(progress.level)}</span>
          {progress.nextLevel !== null && (
            <span className="small muted">
              {t.core(progress.coreDone, progress.coreTotal)}
            </span>
          )}
        </div>
        {progress.nextLevel !== null ? (
          <>
            <ProgressBar value={progress.coreDone} max={progress.coreTotal} label={t.core(progress.coreDone, progress.coreTotal)} />
            <p className="small">{t.finish(progress.nextLevel)}</p>
          </>
        ) : (
          <p className="small">{t.advanced}</p>
        )}
      </Card>

      {dueFollowUps.map((a) => <FollowUp key={a.id} actionId={a.id} text={t.action[a.type] ?? t.didIt} />)}

      {realApiDown ? (
        <ApiDown what={t.apiDown} />
      ) : (
        triggered.map((m) => (
          <section key={m.href} className="card card-dark rise">
            <span className="stat-label" style={{ fontSize: 14, fontWeight: 700 }}>{t.now(m.minutes)}</span>
            <h2 style={{ fontSize: 24 }}>{m.title}</h2>
            <Link href={m.href!} className="btn btn-light" style={{ alignSelf: 'flex-start' }}>
              {t.start}
            </Link>
          </section>
        ))
      )}

      {nextUp && (
        <section className="stat rise" aria-label={t.nextAria}>
          <span className="stat-label" style={{ fontSize: 14, fontWeight: 700 }}>
            {nextUp.progress ? t.resume(nextUp.progress.step, nextUp.progress.of) : t.next(nextUp.minutes)}
          </span>
          <div className="display-md" style={{ color: '#fff' }}>
            {nextUp.title}
          </div>
          {nextUp.hook && <span className="stat-label">{nextUp.hook}</span>}
          <Link href={nextUp.href!} className="btn btn-light" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
            {nextUp.progress ? t.continue : t.start}
          </Link>
        </section>
      )}

      <section className="section" aria-labelledby="nivel">
        <h2 id="nivel" className="section-title">
          {t.forLevel}
        </h2>
        <Card style={{ gap: 0 }}>
          {listed.length ? listed.map((m) => <MomentRow key={m.id} m={m} />) : <p className="small muted">{nextUp ? t.startAbove : t.allDone}</p>}
        </Card>
      </section>

      {rest.length > 0 && (
        <section className="section" aria-labelledby="restul">
          <h2 id="restul" className="section-title">
            {t.rest}
          </h2>
          <Card style={{ gap: 0 }}>
            {rest.filter((m) => m !== nextUp).map((m) => (
              <MomentRow key={m.id} m={m} />
            ))}
          </Card>
        </section>
      )}
      <TabBar current="momente" />
    </main>
  );
}
