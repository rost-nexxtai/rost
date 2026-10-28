'use client';

import { useEffect, useState } from 'react';
import type { StatsResponse } from '@/contract';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import type { AdminCall } from './api';

const RANGES = [7, 30, 90] as const;

const T = copy(
  {
    days: (n: number) => `${n} zile`,
    loading: 'Se încarcă…',
    period: (from: string, to: string) => `De la ${from} până la ${to}. Doar agregate, fără date per utilizator.`,
    users: 'Utilizatori',
    total: 'Total',
    new: 'Noi',
    active: 'Activi',
    withQuiz: 'Cu quiz',
    quiz: 'Quiz',
    started: 'Începute',
    completed: 'Terminate',
    avgScore: 'Scor mediu',
    levelUps: 'Treceri de nivel',
    levels: 'Nivel',
    risk: 'Profil de risc',
    lessons: 'Lecții',
    lesson: 'Lecție',
    opened: 'Deschise',
    done: 'Terminate',
    doneRate: '% terminate',
    correctRate: '% corecte',
    pages: 'Pagini vizitate',
    assets: 'Active',
    views: 'Vizualizări',
    clicks: 'Click-uri la furnizori',
    none: 'Nimic încă.',
  },
  {
    days: (n) => `${n} days`,
    loading: 'Loading…',
    period: (from, to) => `From ${from} to ${to}. Aggregates only, no per-user data.`,
    users: 'Users',
    total: 'Total',
    new: 'New',
    active: 'Active',
    withQuiz: 'With quiz',
    quiz: 'Quiz',
    started: 'Started',
    completed: 'Completed',
    avgScore: 'Average score',
    levelUps: 'Level-ups',
    levels: 'Level',
    risk: 'Risk profile',
    lessons: 'Lessons',
    lesson: 'Lesson',
    opened: 'Opened',
    done: 'Finished',
    doneRate: '% finished',
    correctRate: '% correct',
    pages: 'Pages visited',
    assets: 'Assets',
    views: 'Views',
    clicks: 'Provider clicks',
    none: 'Nothing yet.',
  },
);

/** GET /api/admin/stats: users, quiz, levels, lessons, pages and assets for the chosen period. */
export function StatsPanel({ call }: { call: AdminCall }) {
  const { lang, f } = useLang();
  const t = T[lang];
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [stats, setStats] = useState<StatsResponse>();
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    call<StatsResponse>(`/stats?days=${days}`).then((r) => {
      if (r.ok) setStats(r.data as StatsResponse);
      else setError(r.data.error ?? String(r.status));
    });
  }, [call, days]);

  const rate = (x: number | null) => (x === null ? '–' : f.pct(x * 100, 0));

  return (
    <div className="stack-lg">
      <div className="admin-tabs" role="group">
        {RANGES.map((n) => (
          <button key={n} className="chip" aria-pressed={days === n} onClick={() => setDays(n)}>
            {t.days(n)}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!stats && !error && <p className="muted">{t.loading}</p>}
      {stats && (
        <>
          <p className="small muted">{t.period(stats.from.slice(0, 10), stats.to.slice(0, 10))}</p>
          <section className="card">
            <h2>{t.users}</h2>
            <div className="admin-numbers">
              <Num label={t.total} value={stats.users.total} />
              <Num label={t.new} value={stats.users.new} />
              <Num label={t.active} value={stats.users.active} />
              <Num label={t.withQuiz} value={stats.users.withQuiz} />
            </div>
          </section>
          <section className="card">
            <h2>{t.quiz}</h2>
            <div className="admin-numbers">
              <Num label={t.started} value={stats.quiz.started} />
              <Num label={t.completed} value={stats.quiz.completed} />
              <Num label={t.avgScore} value={stats.quiz.avgScore === null ? '–' : f.num(stats.quiz.avgScore)} />
              <Num label={t.levelUps} value={stats.levelUps} />
            </div>
            <div className="admin-numbers">
              {(['0', '1', '2'] as const).map((l) => (
                <Num key={l} label={`${t.levels} L${l}`} value={stats.levels[l] ?? 0} />
              ))}
              {Object.entries(stats.riskProfile).map(([k, v]) => (
                <Num key={k} label={`${t.risk}: ${k}`} value={v ?? 0} />
              ))}
            </div>
          </section>
          <section className="card">
            <h2>{t.lessons}</h2>
            {stats.library.length === 0 ? (
              <p className="small muted">{t.none}</p>
            ) : (
              <div className="admin-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t.lesson}</th>
                      <th>{t.opened}</th>
                      <th>{t.done}</th>
                      <th>{t.doneRate}</th>
                      <th>{t.correctRate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.library.map((m) => (
                      <tr key={m.momentId}>
                        <td>
                          {m.title} <span className="muted">· L{m.level}</span>
                        </td>
                        <td>{m.opened}</td>
                        <td>{m.completed}</td>
                        <td>{rate(m.completionRate)}</td>
                        <td>{rate(m.correctRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <div className="admin-columns">
            <section className="card">
              <h2>{t.pages}</h2>
              <Counts rows={stats.pages.map((p) => [p.key, p.count])} empty={t.none} />
            </section>
            <section className="card">
              <h2>{t.assets}</h2>
              <Counts rows={stats.assets.map((a) => [a.assetId, `${a.views} ${t.views.toLowerCase()} · ${a.providerClicks} ${t.clicks.toLowerCase()}`])} empty={t.none} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Num({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="admin-num">
      <strong>{value}</strong>
      <span className="small muted">{label}</span>
    </div>
  );
}

function Counts({ rows, empty }: { rows: [string, number | string][]; empty: string }) {
  if (rows.length === 0) return <p className="small muted">{empty}</p>;
  return (
    <div className="stack">
      {rows.map(([k, v]) => (
        <div key={k} className="row small">
          <span>{k}</span>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}
