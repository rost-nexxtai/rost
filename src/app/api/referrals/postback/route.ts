import { NextResponse } from 'next/server';
import { referralPostback } from '@/lib/service';
import { getStore } from '@/lib/store';

/** Called by a partner bank when a referred account is opened or funded. Fees are earned on "funded" only. */
export async function POST(req: Request) {
  const secret = process.env.POSTBACK_SECRET;
  if (secret && req.headers.get('x-postback-secret') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { clickId, status } = (await req.json()) as { clickId: string; status: 'opened' | 'funded' };
  if (status !== 'opened' && status !== 'funded') return NextResponse.json({ error: 'bad status' }, { status: 400 });
  try {
    return NextResponse.json({ referral: await referralPostback(await getStore(), clickId, status) });
  } catch {
    return NextResponse.json({ error: 'unknown click' }, { status: 404 });
  }
}
