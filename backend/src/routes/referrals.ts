import { Hono } from 'hono';
import type { PostbackRequest, PublicPartner, ReferralClickRequest, ReferralClickResponse, ReferralResponse } from '../contract';
import { getPartner, offers, type Partner } from '../lib/reference';
import { referralPostback, trackReferralClick } from '../lib/service';
import { getStore } from '../lib/store';
import { currentUserId } from '../session';

export const referrals = new Hono();

export function publicPartner(p: Partner): PublicPartner {
  return { id: p.id, kind: p.kind, displayName: p.displayName, theme: p.theme, feePerFundedLei: p.feePerFundedLei, feeIsExample: p.feeIsExample };
}

/** Referral click: records it. The frontend then sends the user on (to the mock bank in the demo). */
referrals.post('/referrals/clicks', async (c) => {
  const { offerId } = await c.req.json<ReferralClickRequest>();
  try {
    const { clickId } = await trackReferralClick(await getStore(), offerId, currentUserId(c));
    return c.json({ clickId, offerId } satisfies ReferralClickResponse);
  } catch {
    return c.json({ error: 'unknown offer' }, 404);
  }
});

/** Called by a partner bank when a referred account is opened or funded. Fees are earned on "funded" only. */
referrals.post('/referrals/postback', async (c) => {
  const secret = process.env.POSTBACK_SECRET;
  if (secret && c.req.header('x-postback-secret') !== secret) return c.json({ error: 'forbidden' }, 403);
  const { clickId, status } = await c.req.json<PostbackRequest>();
  if (status !== 'opened' && status !== 'funded') return c.json({ error: 'bad status' }, 400);
  try {
    return c.json({ referral: await referralPostback(await getStore(), clickId, status) });
  } catch {
    return c.json({ error: 'unknown click' }, 404);
  }
});

/** The referral behind a click id, for the mock provider page. */
referrals.get('/referrals/:clickId', async (c) => {
  const referral = await (await getStore()).getReferralByClick(c.req.param('clickId'));
  const offer = referral && offers().find((o) => o.id === referral.offerId);
  if (!referral || !offer) return c.json({ error: 'not found' }, 404);
  const partner = getPartner(offer.partnerId);
  return c.json({ referral, offer, partner: partner && publicPartner(partner) } satisfies ReferralResponse);
});
