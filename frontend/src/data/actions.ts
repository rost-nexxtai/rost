'use server';

import { cookies } from 'next/headers';
import { PERSONAS } from './fixtures/personas';
import { parseProfile, PROFILE_COOKIE, PROFILE_COOKIE_OPTIONS } from './mock/profile';
import { getLibrary } from '.';
import { firstLesson } from './mock/momente';
import { levelWithMoments, passed, quizProfile } from './mock/scoring';
import type { LessonProgress, LibraryMoment, MoneyLine, Profile, QuizAnswers } from './types';

// MOCK until backend ships POST /api/quiz and profile progress on the server.

async function write(p: Profile) {
  (await cookies()).set(PROFILE_COOKIE, JSON.stringify(p), PROFILE_COOKIE_OPTIONS);
  return p;
}

async function current() {
  return parseProfile((await cookies()).get(PROFILE_COOKIE)?.value);
}

export async function saveQuiz(a: QuizAnswers, opts: { retake: boolean } = { retake: false }): Promise<Profile> {
  return write(quizProfile(a, await current(), opts));
}

/** The lesson to start with after the quiz, from the backend's lessons, in the visitor's language. */
export async function nextLesson(p: Profile): Promise<Pick<LibraryMoment, 'id' | 'title' | 'hook' | 'minutes'> | undefined> {
  const lesson = firstLesson(p, await getLibrary());
  return lesson && { id: lesson.id, title: lesson.title, hook: lesson.hook, minutes: lesson.minutes };
}

export async function setDemoProfile(persona: 'maria'): Promise<void> {
  await write(PERSONAS[persona]);
}

/**
 * Records a finished lesson. Only a passed one (2 of 3 graded screens right) counts toward the next
 * level, like the backend's POST /api/library/{id}/complete; a failed attempt changes nothing.
 */
export async function completeLibraryMoment(momentId: string, correct: number, total: number): Promise<{ profile: Profile; passed: boolean } | undefined> {
  const found = await current();
  if (!found) return undefined;
  // finished, passed or not: it's no longer in progress
  const p = { ...found, lessonProgress: withoutLesson(found.lessonProgress, momentId) };
  if (!passed(correct, total)) return { profile: await write(p), passed: false };
  const completedMomentIds = p.completedMomentIds.includes(momentId) ? p.completedMomentIds : [...p.completedMomentIds, momentId];
  return { profile: await write({ ...p, completedMomentIds, level: levelWithMoments(p.quizLevel, completedMomentIds) }), passed: true };
}

/** At most this many lessons are remembered halfway; the oldest is dropped first. */
const MAX_IN_PROGRESS = 8;

function withoutLesson(progress: Profile['lessonProgress'], momentId: string) {
  if (!progress || !(momentId in progress)) return progress;
  const { [momentId]: _, ...rest } = progress;
  return rest;
}

/** Remembers where a lesson was left, so Momente shows it in progress and reopening resumes there. */
export async function saveLessonProgress(momentId: string, progress: LessonProgress): Promise<void> {
  const p = await current();
  if (!p) return;
  const others = Object.entries(withoutLesson(p.lessonProgress, momentId) ?? {}).slice(-(MAX_IN_PROGRESS - 1));
  await write({ ...p, lessonProgress: Object.fromEntries([...others, [momentId, progress]]) });
}

export async function resetProfile(): Promise<void> {
  (await cookies()).delete(PROFILE_COOKIE);
}

/** Saves one money line the user picked inline (Știri), instead of asking for numbers at onboarding. */
export async function saveMoneyLine(line: MoneyLine, lei: number): Promise<Profile | undefined> {
  const p = await current();
  if (!p || !Number.isFinite(lei) || lei < 0) return undefined;
  const known = Array.from(new Set([...(p.money.known ?? []), line]));
  return write({ ...p, money: { ...p.money, [line]: Math.round(lei), known } });
}
