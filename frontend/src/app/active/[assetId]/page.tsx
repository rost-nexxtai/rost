import Link from 'next/link';
import { Simulation } from '@/components/assets/Simulation';
import { ProviderRow } from '@/components/assets/ProviderRow';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { RiskMeter } from '@/components/ui/RiskMeter';
import { TabBar } from '@/components/ui/TabBar';
import { getAsset } from '@/data';

export const dynamic = 'force-dynamic';

const RISK_WORD = { 1: 'foarte mic', 2: 'mic', 3: 'mediu', 4: 'ridicat', 5: 'foarte ridicat' } as const;

export default async function AssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const data = await getAsset(assetId);

  if (!data) {
    return (
      <main className="shell">
        <Back />
        <h1>Nu am găsit pagina</h1>
        <p className="muted">Poate linkul e vechi. Toate opțiunile sunt în Acasă.</p>
        <Link href="/acasa" className="btn btn-primary">
          Înapoi la Acasă
        </Link>
        <TabBar current="acasa" />
      </main>
    );
  }

  const { asset, providers, providerKind, inflationPct } = data;
  const best = providers[0];

  return (
    <main className="shell">
      <Back />
      <header className="stack" style={{ gap: 8 }}>
        <h1>{asset.name}</h1>
        <p className="muted">{asset.oneLine}</p>
      </header>

      <Card>
        <p>{asset.whatItIs}</p>
        <hr className="divider" />
        <Fact label="Risc">
          <RiskMeter value={asset.risk} />
          <span className="small">{RISK_WORD[asset.risk]}</span>
        </Fact>
        <Fact label="Acces">{asset.access}</Fact>
        <Fact label="Impozit 2026">{asset.tax}</Fact>
      </Card>

      <section className="section" aria-labelledby="unde">
        <h2 id="unde" className="section-title">
          {providerKind === 'savings' ? 'Unde găsești' : 'Brokeri'}
        </h2>
        <Card style={{ gap: 0 }}>
          {providers.map((p) => (
            <ProviderRow key={p.id} p={p} />
          ))}
        </Card>
        <p className="note">
          {providerKind === 'savings'
            ? 'Ordinea vine dintr-o formulă publică: randament după impozit, apoi acces, apoi nume. '
            : 'Ordinea vine dintr-o formulă publică: costul unui ordin de 1.000 lei (comision plus diferența de curs), apoi nume. '}
          Partenerii nu plătesc pentru poziție; primim un comision fix doar dacă deschizi și alimentezi un cont.
        </p>
      </section>

      <section className="section" aria-labelledby="simulare">
        <h2 id="simulare" className="section-title">
          Simulare
        </h2>
        <Card>
          <Simulation basis={asset.simulation} ratePct={best?.netRatePct} inflationPct={inflationPct} />
        </Card>
      </section>

      <Link href={`/moment/lib/${asset.momentId}`} className="btn btn-primary btn-block">
        Vreau să aflu mai multe despre {asset.name.split(' (')[0].toLowerCase()}
      </Link>
      <p className="note">Educație financiară, nu consultanță de investiții. Verifică termenii furnizorului înainte să deschizi ceva.</p>
      <TabBar current="acasa" />
    </main>
  );
}

function Back() {
  return (
    <Link href="/acasa" className="link-back">
      <Icon name="back" size={18} /> Acasă
    </Link>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <span className="eyebrow">{label}</span>
      <div className="row-start small" style={{ gap: 10 }}>
        {children}
      </div>
    </div>
  );
}
