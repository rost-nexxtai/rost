import 'server-only';
import { cookies } from 'next/headers';
import { parseProfile, PROFILE_COOKIE } from './mock/profile';
import { buildAcasa } from './mock/acasa';
import type { AcasaResponse, Profile } from './types';

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
  const p = await getProfile();
  return p && buildAcasa(p);
}
