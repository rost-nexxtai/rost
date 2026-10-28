import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FollowUp } from '@/components/ClientActions';
import { MomentRow } from '@/components/momente/MomentRow';
import { ApiDown } from '@/components/ui/ApiDown';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { WeekDots } from '@/components/ui/WeekDots';
import { getLibrary, getMomente, getProfile } from '@/data';
import { buildRoadmap, type RoadmapStep } from '@/data/mock/momente';
import { dayKey, weekOf } from '@/data/mock/rhythm';
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
    locked: (l: number) => `După nivelul L${l}. Poți citi lecțiile oricând.`,
    roadmap: 'Parcursul tău',
    done: 'Gata',
    soon: 'În curând',
    started: (step: number, of: number) => `În curs · ${step}/${of}`,
    life: 'Din viața ta',
    apiDown: 'Momentele declanșate de salariu, inflație sau știri apar aici când revine conexiunea. Lecțiile de mai jos merg oricum.',
    now: (min: number) => `Acum, pe cifrele tale · ${min} min`,
    start: 'Începe',
    next: (min: number) => `Următoarea ta lecție · ${min} min`,
    resume: (step: number, of: number) => `Ai rămas la pasul ${step} din ${of}`,
    continue: 'Continuă',
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
    locked: (l) => `After level L${l}. You can read these lessons any time.`,
    roadmap: 'Your roadmap',
    done: 'Done',
    soon: 'Coming soon',
    started: (step, of) => `In progress · ${step}/${of}`,
    life: 'From your life',
    apiDown: 'Moments triggered by your salary, inflation or the news show up here once the connection is back. The lessons below work anyway.',
    now: (min) => `Now, on your numbers · ${min} min`,
    start: 'Start',
    next: (min) => `Your next lesson · ${min} min`,
    resume: (step, of) => `You stopped at step ${step} of ${of}`,
    continue: 'Continue',
  },
);

export default async function Momente() {
  const [data, profile, lang, library] = await Promise.all([getMomente(), getProfile(), getLang(), getLibrary()]);
  const t = T[lang];
  if (!data || !profile) redirect('/quiz');
  const { triggered, rest, progress, realApiDown, dueFollowUps } = data;
  const roadmap = buildRoadmap(profile, library);
  // moments that came from the user's life (payslip, inflation), not from the roadmap
  const life = rest.filter((m) => m.level === null);

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <h1>{t.title}</h1>

      <Card>
        <div className="row">
          <span className="eyebrow">{t.level(progress.level)}</span>
          {progress.nextLevel !== null && <span className="small muted">{t.core(progress.coreDone, progress.coreTotal)}</span>}
        </div>
        {progress.nextLevel !== null ? (
          <>
            <ProgressBar value={progress.coreDone} max={progress.coreTotal} label={t.core(progress.coreDone, progress.coreTotal)} />
            <p className="small">{t.finish(progress.nextLevel)}</p>
          </>
        ) : (
          <p className="small">{t.advanced}</p>
        )}
        <hr className="divider" />
        <WeekDots week={weekOf(profile.learnedDays, dayKey(new Date()))} lang={lang} />
      </Card>

      {dueFollowUps.map((a) => <FollowUp key={a.id} actionId={a.id} text={t.action[a.type] ?? t.didIt} />)}

      {realApiDown ? (
        <ApiDown what={t.apiDown} />
      ) : (
        triggered.map((m) => (
          // Tinted, not dark: the dark card on this page is the next lesson, and two would compete.
          <section key={m.href} className="card card-tint rise">
            <h2 style={{ fontSize: 22 }}>{m.title}</h2>
            <span className="card-meta">{t.now(m.minutes)}</span>
            <Link href={m.href!} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
              {t.start}
            </Link>
          </section>
        ))
      )}

      {/* Your own money before the library: the payslip and the other life moments come first. */}
      {life.length > 0 && (
        <section className="section" aria-labelledby="life">
          <h2 id="life" className="section-title">
            {t.life}
          </h2>
          <Card style={{ gap: 0 }}>
            {life.map((m) => (
              <MomentRow key={m.id} m={m} />
            ))}
          </Card>
        </section>
      )}

      <h2 className="section-title">{t.roadmap}</h2>
      {roadmap.map((lvl) => (
        <section key={lvl.level} className="road-level" data-reached={lvl.reached || undefined} aria-labelledby={`lvl${lvl.level}`}>
          <header className="road-head">
            <strong id={`lvl${lvl.level}`}>
              L{lvl.level} · {lvl.series}
            </strong>
            <span className="small muted">{lvl.reached ? t.core(lvl.coreDone, lvl.coreTotal) : t.locked(lvl.level - 1)}</span>
          </header>
          <ol className="road">
            {lvl.nodes.map((n) => (
              <RoadStep key={n.id} n={n} t={t} />
            ))}
          </ol>
        </section>
      ))}
      <TabBar current="momente" />
    </main>
  );
}

/** One lesson on the roadmap: a marker on the line, then the lesson. The current one opens into a card. */
function RoadStep({ n, t }: { n: RoadmapStep; t: (typeof T)['ro'] }) {
  const marker = (
    <span className="road-marker" aria-hidden="true">
      {n.state === 'done' ? <Icon name="check" size={16} /> : n.state === 'locked' ? <Icon name="lock" size={14} /> : null}
    </span>
  );
  const text = (
    <span className="road-text">
      <strong>{n.title}</strong>
      <span className="small muted">
        {n.hook ? `${n.hook} · ` : ''}
        {n.minutes} min
      </span>
    </span>
  );
  const tag =
    n.state === 'done' ? (
      <span className="tag tag-done">{t.done}</span>
    ) : n.state === 'soon' ? (
      <span className="tag tag-example">{t.soon}</span>
    ) : n.progress ? (
      <span className="tag tag-progress">{t.started(n.progress.step, n.progress.of)}</span>
    ) : null;

  if (n.state === 'current' && n.href) {
    return (
      <li className="road-step" data-state="current">
        {marker}
        <div className="road-current">
          <strong className="road-current-title">{n.title}</strong>
          {n.hook && <span className="small" style={{ color: 'var(--on-dark-muted)' }}>{n.hook}</span>}
          <span className="card-meta">{n.progress ? t.resume(n.progress.step, n.progress.of) : t.next(n.minutes)}</span>
          <Link href={n.href} className="btn btn-light" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            {n.progress ? t.continue : t.start}
          </Link>
        </div>
      </li>
    );
  }
  return (
    <li className="road-step" data-state={n.state}>
      {marker}
      {n.href ? (
        <Link href={n.href} className="road-row">
          {text}
          {tag ?? (
            <span className="road-chevron">
              <Icon name="chevron" size={18} />
            </span>
          )}
        </Link>
      ) : (
        <div className="road-row">
          {text}
          {tag}
        </div>
      )}
    </li>
  );
}
