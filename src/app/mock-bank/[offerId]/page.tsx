import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lei } from '@/lib/format';
import { getPartner, offers } from '@/lib/reference';
import { referralPostback } from '@/lib/service';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ offerId: string }>; searchParams: Promise<{ click?: string }> };

/**
 * Stage stand-in for a provider's account-opening flow. A real partner calls
 * POST /api/referrals/postback from its own servers; here a server action does the same thing.
 */
export default async function MockBank({ params, searchParams }: Props) {
  const { offerId } = await params;
  const { click } = await searchParams;
  const offer = offers().find((o) => o.id === offerId);
  const store = await getStore();
  const referral = click ? await store.getReferralByClick(click) : undefined;
  if (!offer || !referral) {
    return (
      <main className="shell">
        <h1>Link not found</h1>
        <Link href="/options">Back to options</Link>
      </main>
    );
  }
  const partner = getPartner(offer.partnerId);

  async function advance(formData: FormData) {
    'use server';
    const clickId = String(formData.get('clickId'));
    const status = formData.get('status') === 'funded' ? 'funded' : 'opened';
    await referralPostback(await getStore(), clickId, status);
    redirect(`/mock-bank/${offerId}?click=${clickId}`);
  }

  return (
    <main className="shell">
      <div className="note" style={{ background: '#fff4d6', color: '#5c4400', padding: '8px 12px', borderRadius: 10 }}>
        Mock provider for the demo. No account is opened and no money moves.
      </div>
      <section className="card">
        <span className="eyebrow">{offer.provider}</span>
        <h1>{offer.product}</h1>
        <p className="muted">
          {offer.grossRatePct}% gross a year{offer.termMonths ? ` · ${offer.termMonths} months` : ' · instant access'}
        </p>
      </section>

      <section className="card">
        <div className="row">
          <span>Status</span>
          <strong>{referral.status}</strong>
        </div>
        {referral.status === 'clicked' && (
          <form action={advance}>
            <input type="hidden" name="clickId" value={referral.clickId} />
            <input type="hidden" name="status" value="opened" />
            <button className="btn btn-primary btn-block">Open the account</button>
          </form>
        )}
        {referral.status === 'opened' && (
          <form action={advance}>
            <input type="hidden" name="clickId" value={referral.clickId} />
            <input type="hidden" name="status" value="funded" />
            <button className="btn btn-primary btn-block">Fund it</button>
          </form>
        )}
        {referral.status === 'funded' && (
          <p>
            {partner
              ? `Funded. ${partner.displayName} pays Rost ${lei(referral.feeLei)}${partner.feeIsExample ? ' (example fee)' : ''}. Nothing was paid for the click or the opening.`
              : 'Funded. This provider is not a partner, so Rost earns nothing. We still ranked it where the formula put it.'}
          </p>
        )}
      </section>
      <Link href="/options" className="btn btn-ghost">
        Back to Rost
      </Link>
    </main>
  );
}
