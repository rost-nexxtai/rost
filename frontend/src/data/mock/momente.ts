// MOCK until backend ships GET /api/momente. Triggered moments are real (from GET /api/today).
import type { TodayResponse } from '@/contract';
import { LIBRARY } from '../fixtures/moments';
import type { LibraryMoment, Level, MomenteResponse, MomentSummary, Profile } from '../types';
import { CORE_MOMENTS, foundationFor } from './scoring';

function summary(m: LibraryMoment, done: boolean): MomentSummary {
  const status = done ? 'done' : m.steps.length === 0 ? 'soon' : 'todo';
  return {
    id: m.id,
    title: m.title,
    hook: m.hook,
    series: m.series,
    level: m.level,
    core: m.core,
    minutes: m.minutes,
    status,
    href: status === 'soon' ? undefined : `/moment/lib/${m.id}`,
  };
}

/** Triggered first, then the user's level (own level first, then lower levels not yet done), then the rest. */
export function buildMomente(p: Profile, today: TodayResponse | undefined): MomenteResponse {
  const title = (id: string) => today?.moments.find((d) => d.id === id);
  const triggered: MomentSummary[] = (today?.open ?? []).map((run) => {
    const def = title(run.momentId);
    return {
      id: run.momentId,
      title: def?.title ?? run.momentId,
      series: def?.series ?? '',
      level: null,
      core: false,
      minutes: def?.minutes ?? 3,
      status: 'open',
      href: `/moment/${run.id}`,
    };
  });

  const done = new Set(p.completedMomentIds);
  const forYourLevel = LIBRARY.filter((m) => m.level <= p.level && !done.has(m.id))
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.level - a.m.level || a.i - b.i)
    .map(({ m }) => summary(m, false));

  const realRest: MomentSummary[] = (today?.moments ?? [])
    .filter((d) => !today?.open.some((r) => r.momentId === d.id))
    .filter((d) => today?.doneMomentIds.includes(d.id) || today?.catchUpMomentIds.includes(d.id))
    .map((d) => {
      const isDone = Boolean(today?.doneMomentIds.includes(d.id));
      return {
        id: d.id,
        title: d.title,
        series: d.series,
        level: null,
        core: false,
        minutes: d.minutes,
        status: isDone ? 'done' : 'todo',
        catchUpMomentId: isDone ? undefined : d.id,
      };
    });

  const rest = [
    ...LIBRARY.filter((m) => m.level > p.level || done.has(m.id)).map((m) => summary(m, done.has(m.id))),
    ...realRest,
  ];

  const core = CORE_MOMENTS[p.level];
  return {
    triggered,
    forYourLevel,
    rest,
    progress: {
      level: p.level,
      coreDone: core.filter((id) => done.has(id)).length,
      coreTotal: core.length,
      nextLevel: p.level < 2 ? ((p.level + 1) as Level) : null,
    },
    dueFollowUps: today?.dueFollowUps ?? [],
    realApiDown: today === undefined,
  };
}

/**
 * The one lesson to do next: the emergency fund while there isn't one, else the first playable lesson
 * at your level. The quiz result and Momente both use it, so they never disagree.
 */
export function firstLesson(p: Profile): LibraryMoment | undefined {
  const playable = LIBRARY.filter((m) => m.steps.length > 0 && !p.completedMomentIds.includes(m.id));
  if (foundationFor(p) === 'fond_urgenta') return playable.find((m) => m.id === 'fondul_urgenta') ?? playable[0];
  return playable.find((m) => m.level === p.level) ?? playable.find((m) => m.level <= p.level) ?? playable[0];
}
