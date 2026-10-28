import { jwtVerify, SignJWT } from 'jose';
import { getPartner } from './reference';
import type { CategoryShares } from './rules/inflation';

/**
 * What a partner bank sends when it opens a Rost moment inside its app.
 * No customer identity, no transactions: only an age band, the triggering event and
 * category SHARES the bank computed on its side.
 */
export interface PartnerClaims {
  partnerId: string;
  ageBand: '18-24' | '25-29' | '30-34' | '35+';
  event: 'inflation_published' | 'salary_received' | 'shock_scenario';
  shares: CategoryShares;
  monthly?: { fuel?: number; utilities?: number; food?: number };
  grossMonthly?: number;
  monthlyExpenses?: number;
}

const DEV_SECRET = 'dev-secret-change-me';

function secretFor(partnerId: string): Uint8Array {
  const partner = getPartner(partnerId);
  if (!partner || !partner.secretEnv) throw new Error(`unknown partner ${partnerId}`);
  const secret = process.env[partner.secretEnv] || (process.env.ALLOW_DEMO_TOKEN === 'true' ? DEV_SECRET : '');
  if (!secret) throw new Error(`no secret configured for ${partnerId}`);
  return new TextEncoder().encode(secret);
}

/** Banks sign this on their side. We expose a signer only for the stage demo. */
export async function signPartnerToken(claims: PartnerClaims, ttl = '15m'): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(claims.partnerId)
    .setAudience('rost')
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secretFor(claims.partnerId));
}

export async function verifyPartnerToken(token: string): Promise<PartnerClaims> {
  const [, payloadB64] = token.split('.');
  if (!payloadB64) throw new Error('malformed token');
  const unverified = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { partnerId?: string };
  if (!unverified.partnerId) throw new Error('token has no partnerId');
  const { payload } = await jwtVerify(token, secretFor(unverified.partnerId), {
    issuer: unverified.partnerId,
    audience: 'rost',
  });
  return payload as unknown as PartnerClaims;
}
