import 'server-only';
import { cookies } from 'next/headers';
import type { LibraryMomentResponse, LibraryResponse, TodayResponse } from '@/contract';
import { api, apiOrNothing } from '@/lib/api';
import { parseProfile, PROFILE_COOKIE } from './mock/profile';
import { getLang } from '@/i18n/server';
import { assetsFor, brokersFor, savingsFor } from './fixtures/en';
import { buildAcasa } from './mock/acasa';
import { buildMomente } from './mock/momente';
import { buildStiri } from './mock/stiri';
import { rankBrokers, rankSavings } from './mock/ranking';
import { NATIONAL_INFLATION_PCT } from './mock/scoring';
import type { AcasaResponse, AssetResponse, LibraryMoment, MomenteResponse, Profile, StiriResponse } from './types';

/**
 * The only door screens use to get data. Each function returns a proposed response type
 * (data/types.ts) from fixtures for now; switching to the real API is a change to one body here.
 */

/** MOCK: the profile cookie until GET /api/me returns the profile. */
export async function getProfile(): Promise<Profile | undefined> {
  return parseProfile((await cookies()).get(PROFILE_COOKIE)?.value);
}

/** MOCK until GET /api/acasa. */
export async function getAcasa(): Promise<AcasaResponse | undefined> {
  const [p, lang] = await Promise.all([getProfile(), getLang()]);
  return p && buildAcasa(p, lang);
}

/** MOCK until GET /api/assets/:id. Undefined for an unknown id. */
export async function getAsset(id: string): Promise<AssetResponse | undefined> {
  const lang = await getLang();
  const asset = assetsFor(lang).find((a) => a.id === id);
  if (!asset) return undefined;
  const savings = asset.simulation.kind === 'fixed';
  return {
    asset,
    providers: savings ? rankSavings(savingsFor(lang).filter((p) => p.assetId === asset.id), lang) : rankBrokers(brokersFor(lang), lang),
    providerKind: savings ? 'savings' : 'brokers',
    inflationPct: (await getProfile())?.money.inflationPct ?? NATIONAL_INFLATION_PCT,
  };
}

/**
 * The lessons, from the backend (GET /api/library), in the visitor's language: the API reads the
 * rost_lang cookie that api() forwards. Empty when the backend can't be reached.
 */
export async function getLibrary(): Promise<LibraryMoment[]> {
  try {
    return (await api<LibraryResponse>('/api/library')).moments;
  } catch {
    return [];
  }
}

/** One lesson from the backend. `down` when the backend can't be reached, so the page can say so. */
export async function getLesson(id: string): Promise<LibraryMoment | undefined | 'down'> {
  try {
    return (await apiOrNothing<LibraryMomentResponse>(`/api/library/${encodeURIComponent(id)}`))?.moment;
  } catch {
    return 'down';
  }
}

/** Triggered moments (GET /api/today) and the lessons (GET /api/library) are real; the grouping is still done here. */
export async function getMomente(): Promise<MomenteResponse | undefined> {
  const p = await getProfile();
  if (!p) return undefined;
  const [today, library] = await Promise.all([
    // no session or backend down: still show what we have
    api<TodayResponse>('/api/today').catch(() => undefined),
    getLibrary(),
  ]);
  return buildMomente(p, today, library);
}

/** MOCK until GET /api/stiri. */
export async function getStiri(): Promise<StiriResponse | undefined> {
  const [p, lang] = await Promise.all([getProfile(), getLang()]);
  return p && buildStiri(p, lang);
}
