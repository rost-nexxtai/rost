import type { CSSProperties } from 'react';
import { EmbedMoment } from '@/components/embed/EmbedMoment';
import { scenarioProps } from '@/components/moments/scenario-props';
import { inflationView } from '@/lib/moments/views';
import { verifyPartnerToken, type PartnerClaims } from '@/lib/partner-token';
import { getPartner, getScenario } from '@/lib/reference';

export const dynamic = 'force-dynamic';

/**
 * Partner view, opened from inside a bank's app with a short-lived signed token.
 * The token carries only category shares, an age band and the event: no identity, no transactions.
 */
export default async function Embed({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let claims: PartnerClaims | undefined;
  try {
    claims = token ? await verifyPartnerToken(token) : undefined;
  } catch {
    claims = undefined;
  }
  const partner = claims && getPartner(claims.partnerId);
  if (!claims || !partner) {
    return (
      <main className="shell">
        <h1>This link has expired</h1>
        <p className="muted">Open it again from your bank&apos;s app.</p>
      </main>
    );
  }

  const monthly = { fuel: claims.monthly?.fuel ?? 0, utilities: claims.monthly?.utilities ?? 0, food: claims.monthly?.food ?? 0 };
  const iv = inflationView({
    spending: { shares: claims.shares, monthly, source: 'bank' },
    grossMonthly: claims.grossMonthly,
    monthlyExpenses: claims.monthlyExpenses,
  });
  const s = getScenario('fuel-shortage');
  const scenario = s ? scenarioProps({ ...s, monthlySpend: monthly[s.spendLine] }) : undefined;

  const theme = partner.theme;
  const style = (theme
    ? { '--primary': theme.primary, '--ground': theme.ground, '--ink': theme.ink, '--accent': theme.primary, '--accent-ink': theme.primary, '--accent-tint': '#e3edf3', background: theme.ground, minHeight: '100vh' }
    : {}) as CSSProperties;

  return (
    <div style={style}>
      <main className="shell" style={{ paddingBottom: 40 }}>
        <header className="row" style={{ minHeight: 44 }}>
          <strong style={{ color: 'var(--primary)' }}>{partner.displayName}</strong>
          <span className="small muted">
            with <span style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>rost.</span>
          </span>
        </header>
        <EmbedMoment iv={iv} scenario={scenario} bankName={partner.displayName} />
        <p className="note">
          {partner.displayName} shared only your spending mix by category and an age band. No name, account or transactions. Nothing is
          stored by Rost.
        </p>
      </main>
    </div>
  );
}
