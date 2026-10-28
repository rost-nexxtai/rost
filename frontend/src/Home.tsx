import { useState } from 'react';
import { assetsInPriority, type Asset } from './data';
import type { Profile } from './profile';

const lei = (n: number) => `${Math.round(n).toLocaleString('ro-RO')} lei`;

export function Home({ profile, onLearn }: { profile: Profile; onLearn: (momentId: string) => void }) {
  const [open, setOpen] = useState<string>();

  return (
    <>
      <h1>Unde îți poți ține banii</h1>
      <p className="muted">Primele sunt cele potrivite nivelului tău. Le vezi pe toate, în ordinea priorității.</p>
      {assetsInPriority(profile.level).map((a) => (
        <AssetCard
          key={a.id}
          asset={a}
          recommended={a.level <= profile.level}
          open={open === a.id}
          onToggle={() => setOpen(open === a.id ? undefined : a.id)}
          onLearn={() => onLearn(a.momentId)}
        />
      ))}
      <p className="note">Rate și furnizori de exemplu, nu oferte reale. Educație financiară, nu consultanță de investiții.</p>
    </>
  );
}

function AssetCard({
  asset,
  recommended,
  open,
  onToggle,
  onLearn,
}: {
  asset: Asset;
  recommended: boolean;
  open: boolean;
  onToggle: () => void;
  onLearn: () => void;
}) {
  const best = Math.max(...asset.providers.map((p) => p.ratePct));
  return (
    <section className="card">
      <button className="row reset" onClick={onToggle} aria-expanded={open}>
        <span>
          <strong>{asset.name}</strong>
          <br />
          <span className="small muted">Risc {asset.risk}</span>
        </span>
        <span className="right">
          {recommended ? <span className="badge">Pentru tine</span> : <span className="badge badge-grey">Avansat</span>}
          <br />
          <span className="small muted">până la {best}%</span>
        </span>
      </button>

      {open && (
        <>
          <p className="small">{asset.description}</p>
          <div className="stack">
            <span className="small muted">{asset.rateLabel}</span>
            {asset.providers.map((p) => (
              <div key={p.name} className="row small">
                <span>{p.name}</span>
                <strong>{p.ratePct}%</strong>
              </div>
            ))}
          </div>
          <Simulation ratePct={best} />
          <button className="link" onClick={onLearn}>
            Vreau să aflu mai multe despre {asset.name.toLowerCase()} →
          </button>
        </>
      )}
    </section>
  );
}

const START = 5000;
const YEARS = 5;

/** 5,000 lei left for 5 years at a constant yearly rate, against keeping it as cash. */
function Simulation({ ratePct }: { ratePct: number }) {
  const values = Array.from({ length: YEARS + 1 }, (_, y) => START * (1 + ratePct / 100) ** y);
  const max = values[YEARS];
  const w = 280;
  const h = 100;
  const x = (y: number) => (y / YEARS) * w;
  const yPos = (v: number) => h - ((v - START * 0.9) / (max - START * 0.9)) * h;
  const line = values.map((v, i) => `${x(i)},${yPos(v)}`).join(' ');

  return (
    <div className="stack sim">
      <span className="small muted">
        Simulare: {lei(START)} timp de {YEARS} ani la {ratePct}%/an
      </span>
      <svg viewBox={`-4 -4 ${w + 8} ${h + 8}`} role="img" aria-label={`Crește de la ${lei(START)} la ${lei(max)}`}>
        <line x1={0} x2={w} y1={yPos(START)} y2={yPos(START)} className="baseline" />
        <polyline points={line} className="growth" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={yPos(v)} r={3} className="dot" />
        ))}
      </svg>
      <div className="row small">
        <span className="muted">Azi: {lei(START)}</span>
        <strong>
          Peste {YEARS} ani: {lei(max)}
        </strong>
      </div>
      <span className="note">Linia gri: banii ținuți cash. Randamentele trecute nu garantează rezultate viitoare.</span>
    </div>
  );
}
