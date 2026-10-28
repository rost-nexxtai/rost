import 'server-only';
import { cookies } from 'next/headers';
import type { TodayResponse } from '@/contract';
import { api } from '@/lib/api';
import { parseProfile, PROFILE_COOKIE } from './mock/profile';
import { getLang } from '@/i18n/server';
import { assetsFor, brokersFor, savingsFor } from './fixtures/en';
import { buildAcasa } from './mock/acasa';
import { buildMomente } from './mock/momente';
import { buildStiri } from './mock/stiri';
import { rankBrokers, rankSavings } from './mock/ranking';
import { NATIONAL_INFLATION_PCT } from './mock/scoring';
import type { AcasaResponse, AssetResponse, MomenteResponse, Profile, StiriResponse } from './types';

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

/** Triggered moments are real (GET /api/today); the library is a fixture until GET /api/momente. */
export async function getMomente(): Promise<MomenteResponse | undefined> {
  const p = await getProfile();
  if (!p) return undefined;
  let today: TodayResponse | undefined;
  try {
    today = await api<TodayResponse>('/api/today');
  } catch {
    today = undefined; // no session or backend down: still show the library
  }
  return buildMomente(p, today, await getLang());
}

/** MOCK until GET /api/stiri. */
export async function getStiri(): Promise<StiriResponse | undefined> {
  const [p, lang] = await Promise.all([getProfile(), getLang()]);
  return p && buildStiri(p, lang);
}
