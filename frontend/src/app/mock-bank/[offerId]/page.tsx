import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReferralResponse } from '@backend/contract';
import { api, apiOrNothing } from '@/lib/api';
import { lei } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ offerId: string }>; searchParams: Promise<{ click?: string }> };

const STATUS = { clicked: 'Ai ajuns la bancă', opened: 'Cont deschis', funded: 'Cont alimentat' } as const;

/**
 * Stage stand-in for a provider's account-opening flow. A real partner calls
 * POST /api/referrals/postback from its own servers; here a server action calls the backend the same way.
 */
export default async function MockBank({ params, searchParams }: Props) {
  const { offerId } = await params;
  const { click } = await searchParams;
  const data = click ? await apiOrNothing<ReferralResponse>(`/api/referrals/${encodeURIComponent(click)}`) : undefined;
  if (!data || data.offer.id !== offerId) {
    return (
      <main className="shell shell-bare">
        <h1>Linkul nu mai e valabil</h1>
        <Link href="/acasa" className="btn btn-primary">
          Înapoi la Rost
        </Link>
      </main>
    );
  }
  const { offer, referral, partner } = data;

  async function advance(formData: FormData) {
    'use server';
    const clickId = String(formData.get('clickId'));
    const status = formData.get('status') === 'funded' ? 'funded' : 'opened';
    const secret = process.env.POSTBACK_SECRET;
    await api('/api/referrals/postback', {
      method: 'POST',
      headers: secret ? { 'x-postback-secret': secret } : {},
      body: JSON.stringify({ clickId, status }),
    });
    redirect(`/mock-bank/${offerId}?click=${clickId}`);
  }

  return (
    <main className="shell shell-bare" style={{ background: '#eef1f4', minHeight: '100vh' }}>
      <div className="card" style={{ background: '#fff4d6', borderColor: '#f0dfa8', color: '#5c4400', padding: '10px 14px' }} role="note">
        <p className="small">Bancă simulată pentru demo. Nu se deschide niciun cont și nu se mută bani.</p>
      </div>
      <section className="card">
        <span className="eyebrow">{offer.provider}</span>
        <h1 style={{ fontSize: 26 }}>{offer.product}</h1>
        <p className="muted">
          {offer.grossRatePct}% brut pe an{offer.termMonths ? ` · ${offer.termMonths} luni` : ' · acces oricând'}
        </p>
      </section>

      <section className="card">
        <div className="row">
          <span className="muted">Stare</span>
          <strong>{STATUS[referral.status]}</strong>
        </div>
        {referral.status === 'clicked' && (
          <form action={advance}>
            <input type="hidden" name="clickId" value={referral.clickId} />
            <input type="hidden" name="status" value="opened" />
            <button className="btn btn-primary btn-block">Deschide contul</button>
          </form>
        )}
        {referral.status === 'opened' && (
          <form action={advance}>
            <input type="hidden" name="clickId" value={referral.clickId} />
            <input type="hidden" name="status" value="funded" />
            <button className="btn btn-primary btn-block">Alimentează-l</button>
          </form>
        )}
        {referral.status === 'funded' && (
          <p>
            {partner
              ? `Alimentat. ${partner.displayName} plătește Rost ${lei(referral.feeLei)}${partner.feeIsExample ? ' (comision exemplu)' : ''}. Nu s-a plătit nimic pentru click sau pentru deschidere.`
              : 'Alimentat. Furnizorul nu e partener, așa că Rost nu câștigă nimic. L-am pus totuși exact unde l-a pus formula.'}
          </p>
        )}
      </section>
      <Link href="/acasa" className="btn btn-secondary">
        Înapoi la Rost
      </Link>
    </main>
  );
}
