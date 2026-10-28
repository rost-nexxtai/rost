import { NextResponse } from 'next/server';
import { trackReferralClick } from '@/lib/service';
import { currentUserId } from '@/lib/session';
import { getStore } from '@/lib/store';

/** Referral link: records the click, then sends the user on (to the mock bank in the demo). */
export async function GET(req: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  try {
    const { clickId } = await trackReferralClick(await getStore(), offerId, await currentUserId());
    return NextResponse.redirect(new URL(`/mock-bank/${offerId}?click=${clickId}`, req.url));
  } catch {
    return NextResponse.json({ error: 'unknown offer' }, { status: 404 });
  }
}
