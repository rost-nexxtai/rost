'use server';

import { cookies } from 'next/headers';
import { PERSONAS } from './fixtures/personas';
import { parseProfile, PROFILE_COOKIE, PROFILE_COOKIE_OPTIONS } from './mock/profile';
import { levelWithMoments, profileFromQuiz } from './mock/scoring';
import type { Profile, QuizAnswers } from './types';

// MOCK until backend ships POST /api/quiz and profile progress on the server.

async function write(p: Profile) {
  (await cookies()).set(PROFILE_COOKIE, JSON.stringify(p), PROFILE_COOKIE_OPTIONS);
  return p;
}

async function current() {
  return parseProfile((await cookies()).get(PROFILE_COOKIE)?.value);
}

export async function saveQuiz(a: QuizAnswers): Promise<Profile> {
  const previous = await current();
  const p = profileFromQuiz(a, previous?.name);
  // Retaking the quiz keeps finished moments: the quiz level is a floor, not a reset.
  const completedMomentIds = previous?.completedMomentIds ?? [];
  return write({ ...p, completedMomentIds, level: levelWithMoments(p.quizLevel, completedMomentIds) });
}

export async function setDemoProfile(persona: 'maria'): Promise<void> {
  await write(PERSONAS[persona]);
}

export async function completeLibraryMoment(momentId: string): Promise<Profile | undefined> {
  const p = await current();
  if (!p) return undefined;
  const completedMomentIds = p.completedMomentIds.includes(momentId) ? p.completedMomentIds : [...p.completedMomentIds, momentId];
  return write({ ...p, completedMomentIds, level: levelWithMoments(p.quizLevel, completedMomentIds) });
}

export async function resetProfile(): Promise<void> {
  (await cookies()).delete(PROFILE_COOKIE);
}
