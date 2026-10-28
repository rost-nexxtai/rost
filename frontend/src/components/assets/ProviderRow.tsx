'use client';

import { Icon } from '@/components/ui/Icon';
import type { RankedProvider } from '@/data/types';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    place: (n: number) => `Locul ${n}`,
    site: 'Site oficial',
    siteOf: (name: string) => `Site-ul oficial ${name}, se deschide într-o filă nouă`,
    checked: (month: string) => `verificat ${month}`,
  },
  {
    place: (n) => `Rank ${n}`,
    site: 'Official site',
    siteOf: (name) => `${name}'s official site, opens in a new tab`,
    checked: (month) => `checked ${month}`,
  },
);

/** One real provider: rank, the number that ranks it, its conditions, and a link to its own site. */
export function ProviderRow({ p, style }: { p: RankedProvider; style?: React.CSSProperties }) {
  const t = T[useLang().lang];
  return (
    <div className="provider" style={style}>
      <span className="rank" aria-label={t.place(p.rank)}>
        {p.rank}
      </span>
      <div className="provider-head">
        <span className="provider-name">{p.name}</span>
        <span className="muted small">{p.product}</span>
      </div>
      <div className="provider-body">
        <span className="provider-figure">{p.headline}</span>
        {p.clientsLine && <span className="small muted">{p.clientsLine}</span>}
        {p.taxNote && <span className="small">{p.taxNote}</span>}
        {p.conditions.map((c) => (
          <span key={c} className="note">
            {c}
          </span>
        ))}
        <div className="provider-foot">
          {(p.checked || p.source) && (
            <span className="note">
              {p.checked && t.checked(p.checked)}
              {p.checked && p.source && ' · '}
              {p.source && (
                <a href={p.source.url} target="_blank" rel="noreferrer">
                  {p.source.label}
                </a>
              )}
            </span>
          )}
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="provider-site" aria-label={t.siteOf(p.name)}>
              {t.site} <Icon name="external" size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
