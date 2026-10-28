import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { RiskMeter } from '@/components/ui/RiskMeter';
import type { AssetCard as AssetCardData } from '@/data/types';

export function AssetCard({ asset, later = false }: { asset: AssetCardData; later?: boolean }) {
  return (
    <Link href={`/active/${asset.id}`} className="card card-link" style={{ gap: 10 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 4 }}>
          <h3 style={{ fontSize: 17 }}>{asset.name}</h3>
          <p className="small muted">{asset.oneLine}</p>
        </div>
        <span style={{ color: 'var(--muted)', marginTop: 2 }}>
          <Icon name="chevron" size={20} />
        </span>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', rowGap: 8 }}>
        <RiskMeter value={asset.risk} showLabel />
        {asset.headline && <span className="small" style={{ fontWeight: 600 }}>{asset.headline}</span>}
      </div>
      {(later || asset.aboveRiskProfile) && (
        <div className="row-start" style={{ flexWrap: 'wrap', gap: 6 }}>
          {later && <span className="tag">Lecția se deschide la L{asset.lessonLevel}</span>}
          {asset.aboveRiskProfile && <span className="tag tag-risk">Risc peste profilul tău</span>}
        </div>
      )}
      <span className="sr-only">Vezi opțiuni și simulare</span>
    </Link>
  );
}
