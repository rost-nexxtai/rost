import { SimChart } from '@/components/ui/SimChart';
import { SourceLink } from '@/components/ui/SourceLink';
import { simulateRange } from '@/data/mock/simulation';
import type { Asset } from '@/data/types';
import { lei, pct } from '@/lib/format';

/** What 1,000 lei did over 10 years in the worst, typical and best decade on record. */
export function AssetRangeStep({ asset, onNext }: { asset: Asset; onNext: () => void }) {
  if (asset.simulation.kind !== 'range') return null;
  const s = asset.simulation;
  const r = simulateRange({ startLei: 1000, monthlyLei: 0, years: 10 }, s);
  return (
    <div className="stack-lg rise">
      <span className="eyebrow">Cifrele</span>
      <h1 style={{ fontSize: 26 }}>1.000 lei în {asset.name.toLowerCase()}, după 10 ani</h1>
      <div className="card">
        <div className="row">
          <span className="small muted">Deceniu slab</span>
          <strong className="money">{lei(r.worst.at(-1)!.valueLei)}</strong>
        </div>
        <div className="row">
          <span className="small muted">Tipic</span>
          <strong className="money h2 pos">{lei(r.typical.at(-1)!.valueLei)}</strong>
        </div>
        <div className="row">
          <span className="small muted">Deceniu bun</span>
          <strong className="money">{lei(r.best.at(-1)!.valueLei)}</strong>
        </div>
        <SimChart kind="range" worst={r.worst} typical={r.typical} best={r.best} />
        <p className="note">
          Cel mai rău an: {s.worstYear.year}, {pct(s.worstYear.pct, 1)}. Sursa: <SourceLink label={s.source.label} url={s.source.url} />. În
          dolari, înainte de comisioane și taxe.
        </p>
      </div>
      <button className="btn btn-primary btn-block" onClick={onNext}>
        Mai departe
      </button>
    </div>
  );
}
