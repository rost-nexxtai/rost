import type { CSSProperties } from 'react';
import { EmbedMoment } from '@/components/embed/EmbedMoment';
import { scenarioProps } from '@/lib/scenario';
import type { EmbedResponse } from '@/contract';
import { apiOrNothing } from '@/lib/api';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

const T = copy(
  {
    expired: 'Linkul a expirat',
    reopen: 'Deschide-l din nou din aplicația băncii tale.',
    down: 'Nu ne putem conecta acum',
    downSub: 'Încearcă din nou peste câteva momente, din aplicația băncii tale.',
    with: 'cu',
    privacy: (bank: string) => `${bank} a trimis doar ponderile cheltuielilor pe categorii și o grupă de vârstă. Fără nume, cont sau tranzacții. Rost nu salvează nimic.`,
  },
  {
    expired: 'This link has expired',
    reopen: "Open it again from your bank's app.",
    down: "We can't connect right now",
    downSub: "Try again in a moment, from your bank's app.",
    with: 'with',
    privacy: (bank) => `${bank} shared only your spending mix by category and an age band. No name, account or transactions. Rost stores nothing.`,
  },
);

export const dynamic = 'force-dynamic';

/**
 * Partner view, opened from inside a bank's app with a short-lived signed token.
 * The token carries only category shares, an age band and the event: no identity, no transactions.
 */
export default async function Embed({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = T[await getLang()];
  let data: EmbedResponse | undefined;
  let down = false;
  try {
    // A bad or expired token is a 401 → undefined; an unreachable backend throws.
    data = token ? await apiOrNothing<EmbedResponse>(`/api/embed?token=${encodeURIComponent(token)}`) : undefined;
  } catch {
    down = true;
  }
  if (!data) {
    return (
      <main className="shell">
        <h1>{down ? t.down : t.expired}</h1>
        <p className="muted">{down ? t.downSub : t.reopen}</p>
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
            {t.with} <span style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>rost.</span>
          </span>
        </header>
        <EmbedMoment iv={iv} scenario={scenario} bankName={partner.displayName} />
        <p className="note">{t.privacy(partner.displayName)}</p>
      </main>
    </div>
  );
}
