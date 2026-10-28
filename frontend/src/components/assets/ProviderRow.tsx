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
export function ProviderRow({ p }: { p: RankedProvider }) {
  const t = T[useLang().lang];
  return (
    <div className="list-row" style={{ alignItems: 'flex-start' }}>
      <div className="row-start" style={{ alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
        <span className="rank" aria-label={t.place(p.rank)}>
          {p.rank}
        </span>
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <span>
            <strong>{p.name}</strong>
            <span className="muted small"> · {p.product}</span>
          </span>
          <span className="small" style={{ fontWeight: 600 }}>
            {p.headline}
          </span>
          {p.clientsLine && <span className="small muted">{p.clientsLine}</span>}
          {p.taxNote && <span className="small">{p.taxNote}</span>}
          {p.conditions.map((c) => (
            <span key={c} className="note">
              {c}
            </span>
          ))}
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
        </div>
      </div>
      {p.url && (
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ flexShrink: 0, gap: 4 }} aria-label={t.siteOf(p.name)}>
          {t.site} <Icon name="external" size={14} />
        </a>
      )}
    </div>
  );
}
