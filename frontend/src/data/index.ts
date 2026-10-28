import 'server-only';
import { cookies } from 'next/headers';
import type { AllProvidersResponse, AssetProvidersResponse, LibraryMomentResponse, LibraryResponse, TodayResponse } from '@/contract';
import { api, apiOrNothing } from '@/lib/api';
import { parseProfile, PROFILE_COOKIE } from './mock/profile';
import { getLang } from '@/i18n/server';
import { assetsFor } from './fixtures/en';
import { buildAcasa } from './mock/acasa';
import { buildMomente } from './mock/momente';
import { buildStiri } from './mock/stiri';
import { providerRows } from './providers';
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

/** MOCK until GET /api/acasa; the provider headlines are real (GET /api/providers). */
export async function getAcasa(): Promise<AcasaResponse | undefined> {
  const [p, lang] = await Promise.all([getProfile(), getLang()]);
  if (!p) return undefined;
  // backend down: the cards still show, without the rate line
  const providers = await api<AllProvidersResponse>('/api/providers').catch(() => undefined);
  return buildAcasa(p, lang, providers?.assets);
}

/** The asset's text is a fixture; its providers are real (GET /api/providers/:assetId). Undefined for an unknown id. */
export async function getAsset(id: string): Promise<AssetResponse | undefined> {
  const lang = await getLang();
  const asset = assetsFor(lang).find((a) => a.id === id);
  if (!asset) return undefined;
  const [res, profile] = await Promise.all([
    api<AssetProvidersResponse>(`/api/providers/${encodeURIComponent(asset.id)}`).catch(() => undefined),
    getProfile(),
  ]);
  return {
    asset,
    providers: res ? providerRows(res, lang) : [],
    providerKind: res?.providerKind ?? (asset.simulation.kind === 'fixed' ? 'savings' : 'brokers'),
    inflationPct: profile?.money.inflationPct ?? NATIONAL_INFLATION_PCT,
    providersDown: !res,
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
