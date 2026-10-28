import type { RankedProvider } from '@/data/types';

export function ProviderRow({ p }: { p: RankedProvider }) {
  return (
    <div className="list-row" style={{ alignItems: 'flex-start' }}>
      <div className="row-start" style={{ alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
        <span className="rank" aria-label={`Locul ${p.rank}`}>
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
            {p.isPartner ? <span className="tag tag-partner">Partener · putem primi un comision</span> : <span className="tag">Nu e partener</span>}
            {p.example && <span className="tag tag-example">exemplu</span>}
          </span>
        </div>
      </div>
      {p.offerId ? (
        <a href={`/r/${p.offerId}`} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
          Deschide
        </a>
      ) : (
        <span className="btn btn-secondary btn-sm" aria-disabled="true" style={{ flexShrink: 0 }} title="Deschiderea prin Rost vine în curând">
          În curând
        </span>
      )}
    </div>
  );
}
