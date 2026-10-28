'use client';

import type { RankedProvider } from '@/data/types';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  { place: (n: number) => `Locul ${n}`, partner: 'Partener · putem primi un comision', notPartner: 'Nu e partener', example: 'exemplu', open: 'Deschide', soonTitle: 'Deschiderea prin Rost vine în curând', soon: 'În curând' },
  { place: (n) => `Rank ${n}`, partner: 'Partner · we may earn a fee', notPartner: 'Not a partner', example: 'example', open: 'Open', soonTitle: 'Opening through Rost is coming soon', soon: 'Soon' },
);

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
          <span className="row-start" style={{ gap: 6, flexWrap: 'wrap' }}>
            {p.isPartner ? <span className="tag tag-partner">{t.partner}</span> : <span className="tag">{t.notPartner}</span>}
            {p.example && <span className="tag tag-example">{t.example}</span>}
          </span>
        </div>
      </div>
      {p.offerId ? (
        <a href={`/r/${p.offerId}`} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
          {t.open}
        </a>
      ) : (
        <span className="btn btn-secondary btn-sm" aria-disabled="true" style={{ flexShrink: 0 }} title={t.soonTitle}>
          {t.soon}
        </span>
      )}
    </div>
  );
}
