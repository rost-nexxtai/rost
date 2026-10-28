import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReferralResponse } from '@/contract';
import { api, apiOrNothing } from '@/lib/api';
import { fmt } from '@/lib/format';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ offerId: string }>; searchParams: Promise<{ click?: string }> };

const T = copy(
  {
    status: { clicked: 'Ai ajuns la bancă', opened: 'Cont deschis', funded: 'Cont alimentat' } as Record<'clicked' | 'opened' | 'funded', string>,
    invalid: 'Linkul nu mai e valabil',
    back: 'Înapoi la Rost',
    banner: 'Bancă simulată pentru demo. Nu se deschide niciun cont și nu se mută bani.',
    rate: (pct: number, months: number) => `${pct}% brut pe an${months ? ` · ${months} luni` : ' · acces oricând'}`,
    state: 'Stare',
    open: 'Deschide contul',
    fund: 'Alimentează-l',
    paid: (bank: string, fee: string, example: boolean) =>
      `Alimentat. ${bank} plătește Rost ${fee}${example ? ' (comision exemplu)' : ''}. Nu s-a plătit nimic pentru click sau pentru deschidere.`,
    notPartner: 'Alimentat. Furnizorul nu e partener, așa că Rost nu câștigă nimic. L-am pus totuși exact unde l-a pus formula.',
  },
  {
    status: { clicked: 'You reached the bank', opened: 'Account opened', funded: 'Account funded' },
    invalid: 'This link is no longer valid',
    back: 'Back to Rost',
    banner: 'A simulated bank for the demo. No account is opened and no money moves.',
    rate: (pct, months) => `${pct}% gross a year${months ? ` · ${months} months` : ' · access any time'}`,
    state: 'Status',
    open: 'Open the account',
    fund: 'Fund it',
    paid: (bank, fee, example) => `Funded. ${bank} pays Rost ${fee}${example ? ' (example fee)' : ''}. Nothing was paid for the click or the opening.`,
    notPartner: "Funded. The provider isn't a partner, so Rost earns nothing. We still ranked it exactly where the formula put it.",
  },
);

/**
 * Stage stand-in for a provider's account-opening flow. A real partner calls
 * POST /api/referrals/postback from its own servers; here a server action calls the backend the same way.
 */
export default async function MockBank({ params, searchParams }: Props) {
  const { offerId } = await params;
  const { click } = await searchParams;
  const lang = await getLang();
  const t = T[lang];
  const data = click ? await apiOrNothing<ReferralResponse>(`/api/referrals/${encodeURIComponent(click)}`).catch(() => undefined) : undefined;
  if (!data || data.offer.id !== offerId) {
    return (
      <main className="shell shell-bare">
        <h1>{t.invalid}</h1>
        <Link href="/acasa" className="btn btn-primary">
          {t.back}
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
        <p className="small">{t.banner}</p>
      </div>
      <section className="card">
        <span className="eyebrow">{offer.provider}</span>
        <h1 style={{ fontSize: 26 }}>{offer.product}</h1>
        <p className="muted">{t.rate(offer.grossRatePct, offer.termMonths)}</p>
      </section>

      <section className="card">
        <div className="row">
          <span className="muted">{t.state}</span>
          <strong>{t.status[referral.status]}</strong>
        </div>
        {referral.status === 'clicked' && (
          <form action={advance}>
            <input type="hidden" name="clickId" value={referral.clickId} />
            <input type="hidden" name="status" value="opened" />
            <button className="btn btn-primary btn-block">{t.open}</button>
          </form>
        )}
        {referral.status === 'opened' && (
          <form action={advance}>
            <input type="hidden" name="clickId" value={referral.clickId} />
            <input type="hidden" name="status" value="funded" />
            <button className="btn btn-primary btn-block">{t.fund}</button>
          </form>
        )}
        {referral.status === 'funded' && (
          <p>
            {partner
              ? t.paid(partner.displayName, fmt(lang).lei(referral.feeLei), Boolean(partner.feeIsExample))
              : t.notPartner}
          </p>
        )}
      </section>
      <Link href="/acasa" className="btn btn-secondary">
        {t.back}
      </Link>
    </main>
  );
}
