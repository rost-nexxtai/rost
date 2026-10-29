import 'server-only';
import { cache } from 'react';
import type { AllProvidersResponse, AssetProvidersResponse, DemoResponse, LibraryMomentResponse, LibraryResponse, MeResponse, PayslipBreakdown, TodayResponse } from '@/contract';
import { api, apiOrNothing } from '@/lib/api';
import { getLang } from '@/i18n/server';
import { assetsFor, newsInLang } from './fixtures/en';
import { buildAcasa } from './mock/acasa';
import { buildMomente } from './mock/momente';
import { providerRows } from './providers';
import { NATIONAL_INFLATION_PCT } from './mock/scoring';
import type { AcasaResponse, AssetResponse, LibraryMoment, MomenteResponse, Profile, StiriResponse } from './types';

/**
 * The only door screens use to get data. The user and their profile come from the backend; a few
 * views (Acasă, the Momente grouping, Știri) are still put together here from it.
 */

/**
 * The backend can't be reached. Pages let it go up to app/error.tsx, so an outage shows an error, not the
 * quiz a missing profile leads to.
 */
export class BackendDown extends Error {
  constructor() {
    super('backend unreachable');
    this.name = 'BackendDown';
  }
}

/** GET /api/me once per request: several screens read both the user and the profile. */
const me = cache(async (): Promise<MeResponse | undefined | 'down'> => {
  try {
    return await apiOrNothing<MeResponse>('/api/me');
  } catch {
    return 'down';
  }
});

/** The profile the backend built from the quiz, lessons and the user's numbers. Undefined before the quiz or without a session; throws BackendDown when the backend can't be reached. */
export async function getProfile(): Promise<Profile | undefined> {
  const m = await me();
  if (m === 'down') throw new BackendDown();
  return m?.profile;
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
    // the asset still shows with national inflation
    getProfile().catch(() => undefined),
  ]);
  return {
    asset,
    providers: res ? providerRows(res, lang) : [],
    providerKind: res?.providerKind ?? (asset.simulation.kind === 'fixed' ? 'savings' : 'brokers'),
    inflationPct: profile?.money.inflationPct ?? NATIONAL_INFLATION_PCT,
    inflationPersonal: !!profile?.money.inflationPersonal,
    savedLei: profile?.money.known?.includes('savedLei') && profile.money.savedLei > 0 ? profile.money.savedLei : undefined,
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

/** GET /api/stiri: the news, ordered by what each costs this user a month, in the visitor's language. Undefined before the quiz; throws BackendDown when unreachable. */
export async function getStiri(): Promise<StiriResponse | undefined> {
  const lang = await getLang();
  let out: StiriResponse | undefined;
  try {
    out = await apiOrNothing<StiriResponse>('/api/stiri');
  } catch {
    throw new BackendDown();
  }
  return out && { ...out, items: out.items.map((n) => newsInLang(n, lang)) };
}

/** GET /api/demo: whether the demo tools are on. Off when the backend can't be reached. */
export async function getDemoEnabled(): Promise<boolean> {
  return api<DemoResponse>('/api/demo').then(
    (d) => d.enabled,
    () => false,
  );
}

/** The backend's record of the user (salary, dates, spending, inflation). `down` when unreachable; undefined without a session. */
export async function getMe(): Promise<MeResponse | undefined | 'down'> {
  return me();
}

/**
 * The user's salary and where it goes, from the backend (GET /api/me, GET /api/payslip).
 * `down` when the backend can't be reached; `undefined` without a session.
 */
export async function getSalary(): Promise<{ gross?: number; lastRaiseDate?: string; payslip?: PayslipBreakdown } | undefined | 'down'> {
  const m = await me();
  if (!m || m === 'down') return m;
  try {
    const gross = m.user.grossMonthly;
    const payslip = gross ? await api<PayslipBreakdown>(`/api/payslip?gross=${gross}`) : undefined;
    return { gross, lastRaiseDate: m.user.lastRaiseDate, payslip };
  } catch {
    return 'down';
  }
}
