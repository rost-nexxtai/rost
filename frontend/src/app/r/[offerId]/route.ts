import { NextResponse } from 'next/server';
import type { ReferralClickResponse } from '@/contract';
import { api } from '@/lib/api';

/** Referral link: the backend records the click, then we send the user on (to the mock bank in the demo). */
export async function GET(req: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  try {
    const { clickId } = await api<ReferralClickResponse>('/api/referrals/clicks', { method: 'POST', body: JSON.stringify({ offerId }) });
    return NextResponse.redirect(new URL(`/mock-bank/${offerId}?click=${clickId}`, req.url));
  } catch {
    return NextResponse.json({ error: 'unknown offer' }, { status: 404 });
  }
}
