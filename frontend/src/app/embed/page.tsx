import type { CSSProperties } from 'react';
import { EmbedMoment } from '@/components/embed/EmbedMoment';
import { scenarioProps } from '@/lib/scenario';
import type { EmbedResponse } from '@/contract';
import { apiOrNothing } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Partner view, opened from inside a bank's app with a short-lived signed token.
 * The token carries only category shares, an age band and the event: no identity, no transactions.
 */
export default async function Embed({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const data = token ? await apiOrNothing<EmbedResponse>(`/api/embed?token=${encodeURIComponent(token)}`) : undefined;
  if (!data) {
    return (
      <main className="shell">
        <h1>Linkul a expirat</h1>
        <p className="muted">Deschide-l din nou din aplicația băncii tale.</p>
      </main>
    );
  }

  const { partner, inflation: iv } = data;
  const scenario = data.scenario ? scenarioProps(data.scenario) : undefined;

  const theme = partner.theme;
  const style = (theme
    ? { '--primary': theme.primary, '--ground': theme.ground, '--ink': theme.ink, '--accent': theme.primary, '--accent-ink': theme.primary, '--accent-tint': '#e3edf3', '--primary-tint': '#e3edf3', background: theme.ground, minHeight: '100vh' }
    : {}) as CSSProperties;

  return (
    <div style={style}>
      <main className="shell" style={{ paddingBottom: 170 }}>
        <header className="row" style={{ minHeight: 44 }}>
          <strong style={{ color: 'var(--primary)' }}>{partner.displayName}</strong>
          <span className="small muted">
            cu <span style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>rost.</span>
          </span>
        </header>
        <EmbedMoment iv={iv} scenario={scenario} bankName={partner.displayName} />
        <p className="note">
          {partner.displayName} a trimis doar ponderile cheltuielilor pe categorii și o grupă de vârstă. Fără nume, cont sau tranzacții.
          Rost nu salvează nimic.
        </p>
      </main>
    </div>
  );
}
