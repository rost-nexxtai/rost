import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FollowUp } from '@/components/ClientActions';
import { MomentRow } from '@/components/momente/MomentRow';
import { ApiDown } from '@/components/ui/ApiDown';
import { Card } from '@/components/ui/Card';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { GAME } from '@/components/game/copy';
import { WeekStrip } from '@/components/game/WeekStrip';
import { Icon } from '@/components/ui/Icon';
import { getLibrary, getMomente, getProfile } from '@/data';
import { BADGES, dayKey, streakOn, weekOf } from '@/data/mock/game';
import { buildPath, type PathNode } from '@/data/mock/momente';
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
    locked: (l: number) => `Se deblochează când termini L${l}`,
    keepStreak: (n: number) => (n === 1 ? 'Fă o lecție azi ca să-ți păstrezi seria.' : `Fă o lecție azi ca să-ți păstrezi seria de ${n} zile.`),
    doneToday: 'Lecția de azi e bifată. Ne vedem mâine!',
    startStreak: 'O lecție pe zi, 3 minute. Începe o serie azi.',
    path: 'Drumul tău',
    soon: 'în curând',
    life: 'Din viața ta',
    peek: 'Poți arunca o privire',
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
    locked: (l) => `Unlocks when you finish L${l}`,
    keepStreak: (n) => (n === 1 ? 'Do a lesson today to keep your streak.' : `Do a lesson today to keep your ${n}-day streak.`),
    doneToday: "Today's lesson is done. See you tomorrow!",
    startStreak: 'One lesson a day, 3 minutes. Start a streak today.',
    path: 'Your path',
    soon: 'coming soon',
    life: 'From your life',
    peek: 'You can take a peek',
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
  const g = GAME[lang];
  if (!data || !profile) redirect('/quiz');
  const { triggered, rest, realApiDown, dueFollowUps } = data;
  const today = dayKey(new Date());
  const streak = streakOn(profile.game, today);
  const path = buildPath(profile, library);
  // moments that came from the user's life (payslip, inflation), not from the lesson path
  const life = rest.filter((m) => m.level === null);
  const earned = new Set(profile.game?.badges ?? []);

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <h1>{t.title}</h1>

      <section className="card game-card" aria-label={`${g.streak}: ${g.days(streak.days)}, ${profile.game?.xp ?? 0} XP`}>
        <div className="game-stats">
          <span className="game-stat" data-on={streak.days > 0 || undefined} data-risk={streak.atRisk || undefined}>
            <Icon name="flame" size={22} />
            <strong>{streak.days}</strong>
            <span className="small muted">{g.streak}</span>
          </span>
          <span className="game-stat game-stat-xp">
            <Icon name="bolt" size={22} />
            <strong>{profile.game?.xp ?? 0}</strong>
            <span className="small muted">{g.xp}</span>
          </span>
        </div>
        <WeekStrip week={weekOf(profile.game, today)} letters={g.weekdays} />
        <p className="small" style={{ margin: 0 }}>
          {streak.atRisk ? t.keepStreak(streak.days) : streak.doneToday ? t.doneToday : t.startStreak}
        </p>
      </section>

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

      <h2 className="section-title">{t.path}</h2>
      {path.map((lvl) => (
        <section key={lvl.level} className="path-level" data-reached={lvl.reached || undefined} aria-labelledby={`lvl${lvl.level}`}>
          <header className="path-head">
            <span className="path-head-badge">L{lvl.level}</span>
            <div className="stack" style={{ gap: 2 }}>
              <strong id={`lvl${lvl.level}`}>
                {t.level(lvl.level)} · {lvl.series}
              </strong>
              <span className="small muted">{lvl.reached ? t.core(lvl.coreDone, lvl.coreTotal) : `${t.locked(lvl.level - 1)} · ${t.peek}`}</span>
            </div>
          </header>
          <ol className="path">
            {lvl.nodes.map((n, i) => (
              <PathStep key={n.id} n={n} side={SIDES[i % SIDES.length]} t={t} />
            ))}
          </ol>
        </section>
      ))}

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

      <section className="section" aria-labelledby="badges">
        <h2 id="badges" className="section-title">
          {g.badges} · {earned.size}/{BADGES.length}
        </h2>
        <ul className="shelf">
          {BADGES.map(({ id }) => (
            <li key={id} data-earned={earned.has(id) || undefined} title={g.badge[id].what}>
              <span className="badge-medal">
                <Icon name={earned.has(id) ? 'medal' : 'lock'} size={22} />
              </span>
              <span className="small">{g.badge[id].name}</span>
            </li>
          ))}
        </ul>
      </section>
      <TabBar current="momente" />
    </main>
  );
}

/** The path winds left and right, like a trail. */
const SIDES = ['mid', 'right', 'mid', 'left'] as const;

function PathStep({ n, side, t }: { n: PathNode; side: (typeof SIDES)[number]; t: (typeof T)['ro'] }) {
  const icon = n.state === 'done' ? 'check' : n.state === 'locked' ? 'lock' : n.state === 'soon' ? 'momente' : 'star';
  const node = (
    <span className="path-node" aria-hidden="true">
      <Icon name={icon} size={n.state === 'current' ? 30 : 24} />
    </span>
  );
  return (
    <li className="path-step" data-side={side} data-state={n.state}>
      {n.state === 'current' && n.href ? (
        <div className="path-current rise">
          <Link href={n.href} className="path-node-link" aria-label={n.title}>
            {node}
          </Link>
          <div className="path-bubble">
            <span className="small" style={{ fontWeight: 700, color: '#d8dbe0' }}>
              {n.progress ? t.resume(n.progress.step, n.progress.of) : t.next(n.minutes)}
            </span>
            <strong className="path-bubble-title">{n.title}</strong>
            {n.hook && <span className="small" style={{ color: '#d8dbe0' }}>{n.hook}</span>}
            <Link href={n.href} className="btn btn-light" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              {n.progress ? t.continue : t.start}
            </Link>
          </div>
        </div>
      ) : n.href ? (
        <Link href={n.href} className="path-node-link">
          {node}
          <span className="path-title">{n.title}</span>
        </Link>
      ) : (
        <div className="path-node-link">
          {node}
          <span className="path-title">
            {n.title} · {t.soon}
          </span>
        </div>
      )}
    </li>
  );
}
