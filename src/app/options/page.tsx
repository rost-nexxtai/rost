import Link from 'next/link';
import { Nav, TopBar } from '@/components/Nav';
import { lei, pct } from '@/lib/format';
import { latestCpi, offers } from '@/lib/reference';
import { personalInflation, rankOffers, realChange, type Horizon } from '@/lib/rules';
import { currentUserId } from '@/lib/session';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

const HORIZONS: { id: Horizon; label: string }[] = [
  { id: 'any_time', label: 'Any time' },
  { id: 'one_to_two_years', label: 'In 1–2 years' },
  { id: 'later', label: 'Later' },
];
const AMOUNTS = [1000, 5000, 10000, 25000];
const ACCESS = { 1: 'Take it out any time', 2: 'Lose the interest if you break it', 3: 'Locked until maturity' } as const;

type Search = Promise<{ horizon?: string; amount?: string }>;

/**
 * Neutral ranking at the end of a savings moment. Order = public formula only.
 * Partners are labelled, and we say what we earn. Partner status never changes the order (see ranking.test.ts).
 */
export default async function Options({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const horizon = (HORIZONS.find((h) => h.id === sp.horizon)?.id ?? 'one_to_two_years') as Horizon;
  const amount = AMOUNTS.includes(Number(sp.amount)) ? Number(sp.amount) : 10000;

  const uid = await currentUserId();
  const user = uid ? await (await getStore()).getUser(uid) : undefined;
  const cpi = latestCpi();
  const inflation = user?.spending ? personalInflation(user.spending.shares, cpi.groupsPct).personalPct : cpi.headlinePct;
  const inflationLabel = user?.spending ? 'your inflation' : 'national inflation';

  const ranked = rankOffers(offers(), { horizon, amountLei: amount });
  const href = (h: Horizon, a: number) => `/options?horizon=${h}&amount=${a}`;

  return (
    <main className="shell">
      <TopBar />
      <section className="stack" style={{ gap: 4 }}>
        <h1>Where to keep your savings</h1>
        <p className="muted">
          Ranked by what you keep after tax. Compared with {inflationLabel}: {pct(inflation, 2)}.
        </p>
      </section>

      <section className="card">
        <span className="small muted">When might you need the money?</span>
        <div className="grid3" role="group" aria-label="When you need the money">
          {HORIZONS.map((h) => (
            <Link key={h.id} href={href(h.id, amount)} className="chip" aria-pressed={h.id === horizon} style={chipLink}>
              {h.label}
            </Link>
          ))}
        </div>
        <span className="small muted">How much?</span>
        <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }} role="group" aria-label="Amount">
          {AMOUNTS.map((a) => (
            <Link key={a} href={href(horizon, a)} className="chip" aria-pressed={a === amount} style={{ ...chipLink, fontSize: 14 }}>
              {a.toLocaleString('en-US')}
            </Link>
          ))}
        </div>
      </section>

      {ranked.length === 0 && <p className="muted">Nothing in the list fits this amount and time yet.</p>}

      {ranked.map((o) => {
        const real = realChange(amount, o.netRatePct, inflation);
        return (
          <section key={o.id} className="card">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="row" style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                <span className="rank">{o.rank}</span>
                <span>
                  <strong>{o.provider}</strong>
                  <br />
                  <span className="small muted">{o.product}</span>
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <strong className="h2">{pct(o.netRatePct, 2)}</strong>
                <br />
                <span className="small muted">after tax</span>
              </span>
            </div>
            <div className="row small">
              <span>+{lei(o.gainLei)} a year</span>
              <span style={{ color: real < 0 ? 'var(--accent-ink)' : 'var(--ink)' }}>
                {real >= 0 ? `Beats ${inflationLabel} by ${lei(real)}` : `Loses ${lei(-real)} to ${inflationLabel}`}
              </span>
            </div>
            <p className="small muted">
              {ACCESS[o.accessRank]}
              {o.kind === 'state_bond' ? ' · state bond, no tax on interest' : ' · 10% tax on interest'}
              {o.conditions.length ? ` · ${o.conditions.join(' · ')}` : ''}
            </p>
            <div className="row">
              {o.isPartner ? <span className="badge">Partner · we may earn a fee</span> : <span className="small muted">Not a partner</span>}
              <a href={`/r/${o.id}`} className="btn btn-ghost" style={{ minHeight: 40 }}>
                Open
              </a>
            </div>
          </section>
        );
      })}

      <section className="card card-tint">
        <h2>How we rank</h2>
        <p className="small">
          1. Net yearly return after tax (deposits lose 10% of interest to tax; state bonds don&apos;t). 2. Easier access first. 3. Name.
          Partner status is not an input, and a test in our code checks it.
        </p>
        <p className="small">
          When you open and fund an account with a partner, the partner pays us a flat fee. Same fee whatever the rate, so we have no
          reason to push one over another.
        </p>
      </section>
      {ranked.some((o) => o.example) && <p className="note">Example rates and providers for the demo, not live offers.</p>}
      <p className="note">Education, not financial advice. Check the provider&apos;s terms before you open anything.</p>
      <Nav current="/options" />
    </main>
  );
}

const chipLink = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 14 } as const;
