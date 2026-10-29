'use server';

import type { CompleteLessonResponse, LessonAnswer, UpdateMeResponse } from '@/contract';
import { api, ApiError } from '@/lib/api';
import { updateMeBody, type MyMoney } from './mock/money';
import { getLibrary } from '.';
import { firstLesson } from './mock/momente';
import { dayKey, weekOf, type WeekDay } from './mock/rhythm';
import type { LessonProgress, LibraryMoment, MoneyLine, Profile } from './types';

// The profile lives in the backend: these write to it through the API, with the browser's session.
// The quiz is sent from the browser itself (POST /api/quiz), so a new user's session cookie lands there.

/** The lesson to start with after the quiz, from the backend's lessons, in the visitor's language. */
export async function nextLesson(p: Profile): Promise<Pick<LibraryMoment, 'id' | 'title' | 'hook' | 'minutes'> | undefined> {
  const lesson = firstLesson(p, await getLibrary());
  return lesson && { id: lesson.id, title: lesson.title, hook: lesson.hook, minutes: lesson.minutes };
}

/** No session or no quiz yet: the API answers 401 or 404, which is "nothing to save to", not a failure. */
const nobody = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.status === 404);

/**
 * Records a finished lesson. The backend scores the answers: only a passed one (2 of 3 graded
 * screens right) counts toward the next level. Either way the day counts as a day you learned,
 * and the week comes back for the end screen.
 */
export async function completeLibraryMoment(
  momentId: string,
  answers: LessonAnswer[],
): Promise<{ profile: Profile; passed: boolean; correct: number; total: number; week: WeekDay[] } | undefined> {
  try {
    const out = await api<CompleteLessonResponse>(`/api/library/${encodeURIComponent(momentId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
    if (!out.profile) return undefined;
    const { profile, passed, correct, total } = out;
    return { profile, passed, correct, total, week: weekOf(profile.learnedDays, dayKey(new Date())) };
  } catch (e) {
    if (nobody(e)) return undefined;
    throw e;
  }
}

/** Remembers where a lesson was left, so Momente shows it in progress and reopening resumes there. */
export async function saveLessonProgress(momentId: string, progress: LessonProgress): Promise<void> {
  await api(`/api/library/${encodeURIComponent(momentId)}/progress`, { method: 'PUT', body: JSON.stringify(progress) }).catch((e) => {
    if (!nobody(e)) throw e;
  });
}

/**
 * Profil → "Banii tăi": saved to the backend (PATCH /api/me). A new salary goes through
 * PUT /api/me/salary, so a raise reopens the payslip. Without a session nothing is saved, and the
 * answer says so.
 */
export async function saveMyMoney(m: MyMoney, grossBefore?: number): Promise<{ saved: boolean; inflationPct?: number; personal?: boolean }> {
  try {
    const out = await api<UpdateMeResponse>('/api/me', { method: 'PATCH', body: JSON.stringify(updateMeBody(m)) });
    if (m.situation === 'employed' && m.grossMonthly && m.grossMonthly !== grossBefore) {
      await api('/api/me/salary', { method: 'PUT', body: JSON.stringify({ grossMonthly: m.grossMonthly }) });
    }
    return { saved: true, inflationPct: out.inflation.personalPct ?? out.inflation.headlinePct, personal: out.inflation.personalPct !== null };
  } catch {
    return { saved: false };
  }
}

/** Saves one money line the user picked inline (Știri), instead of asking for numbers at onboarding. */
export async function saveMoneyLine(line: MoneyLine, lei: number): Promise<Profile | undefined> {
  if (!Number.isFinite(lei) || lei < 0) return undefined;
  const out = await api<UpdateMeResponse>('/api/me', { method: 'PATCH', body: JSON.stringify({ moneyLines: { [line]: Math.round(lei) } }) }).catch(() => undefined);
  return out?.profile;
}
