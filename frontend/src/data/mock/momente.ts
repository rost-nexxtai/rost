// Groups the lessons (from GET /api/library) and the triggered moments (from GET /api/today) for Momente.
import type { TodayResponse } from '@/contract';
import type { LibraryMoment, Level, MomenteResponse, MomentSummary, Profile } from '../types';
import { CORE_MOMENTS, foundationFor } from './scoring';

/** Where a started lesson was left, when the lesson hasn't changed since. */
export function resumable(m: LibraryMoment, p: Pick<Profile, 'lessonProgress'>) {
  const at = p.lessonProgress?.[m.id];
  return at && at.of === m.steps.length && at.step > 0 && at.step < m.steps.length - 1 ? at : undefined;
}

function summary(m: LibraryMoment, done: boolean, p: Profile): MomentSummary {
  const at = resumable(m, p);
  // a lesson replayed halfway shows in progress, not done
  const status = at ? 'started' : done ? 'done' : m.steps.length === 0 ? 'soon' : 'todo';
  return {
    progress: at && { step: at.step + 1, of: m.steps.length },
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
export function buildMomente(p: Profile, today: TodayResponse | undefined, library: LibraryMoment[]): MomenteResponse {
  const LIBRARY = library;
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
    // Started lessons first, then ones you can play; ones still being written ("în curând") last. Then own level first.
    .sort(
      (a, b) =>
        Number(!resumable(a.m, p)) - Number(!resumable(b.m, p)) ||
        Number(!a.m.steps.length) - Number(!b.m.steps.length) ||
        b.m.level - a.m.level ||
        a.i - b.i,
    )
    .map(({ m }) => summary(m, false, p));

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
        catchUpNeedsSalary: !isDone && Boolean(today?.catchUpNeeds?.[d.id]?.includes('grossMonthly')),
      };
    });

  const rest = [
    ...LIBRARY.filter((m) => m.level > p.level || done.has(m.id)).map((m) => summary(m, done.has(m.id), p)),
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
export function firstLesson(p: Profile, library: LibraryMoment[]): LibraryMoment | undefined {
  const playable = library.filter((m) => m.steps.length > 0 && !p.completedMomentIds.includes(m.id));
  if (foundationFor(p) === 'fond_urgenta') return playable.find((m) => m.id === 'fondul_urgenta') ?? playable[0];
  return playable.find((m) => m.level === p.level) ?? playable.find((m) => m.level <= p.level) ?? playable[0];
}

export type RoadmapStep = MomentSummary & { state: 'done' | 'current' | 'open' | 'locked' | 'soon' };

/** One level of the roadmap: its lessons in order, and how many of its core ones are done. */
export interface RoadmapLevel {
  level: Level;
  series: string;
  coreDone: number;
  coreTotal: number;
  /** The user is at this level or past it. */
  reached: boolean;
  nodes: RoadmapStep[];
}

/**
 * The lessons as a roadmap, level by level, with one "current" lesson: the one left halfway, else the
 * one firstLesson picks. Lessons above your level stay open to peek at, but show as locked.
 */
export function buildRoadmap(p: Profile, library: LibraryMoment[]): RoadmapLevel[] {
  const done = new Set(p.completedMomentIds);
  const current = library.find((m) => resumable(m, p)) ?? firstLesson(p, library);
  return ([0, 1, 2] as Level[])
    .map((level) => {
      const lessons = library.filter((m) => m.level === level);
      const core = CORE_MOMENTS[level];
      return {
        level,
        series: lessons[0]?.series ?? '',
        coreDone: core.filter((id) => done.has(id)).length,
        coreTotal: core.length,
        reached: level <= p.level,
        nodes: lessons.map((m): RoadmapStep => {
          const s = summary(m, done.has(m.id), p);
          const state =
            m.id === current?.id ? 'current' : s.status === 'soon' ? 'soon' : s.status === 'done' ? 'done' : level > p.level ? 'locked' : 'open';
          return { ...s, state };
        }),
      };
    })
    .filter((l) => l.nodes.length > 0);
}
