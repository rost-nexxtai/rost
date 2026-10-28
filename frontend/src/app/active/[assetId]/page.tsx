import Link from 'next/link';
import { Simulation } from '@/components/assets/Simulation';
import { ProviderRow } from '@/components/assets/ProviderRow';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { RiskMeter } from '@/components/ui/RiskMeter';
import { TabBar } from '@/components/ui/TabBar';
import { getAsset } from '@/data';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const T = copy(
  {
    riskWord: { 1: 'foarte mic', 2: 'mic', 3: 'mediu', 4: 'ridicat', 5: 'foarte ridicat' } as Record<1 | 2 | 3 | 4 | 5, string>,
    notFound: 'Nu am găsit pagina',
    old: 'Poate linkul e vechi. Toate opțiunile sunt în Acasă.',
    backHome: 'Înapoi la Acasă',
    home: 'Acasă',
    risk: 'Risc',
    access: 'Acces',
    tax: 'Impozit 2026',
    where: 'Unde găsești',
    brokers: 'Brokeri',
    orderSavings: 'Ordinea vine dintr-o formulă publică: randament după impozit, apoi acces, apoi nume. ',
    orderBrokers: 'Ordinea vine dintr-o formulă publică: costul unui ordin de 1.000 lei (comision plus diferența de curs), apoi nume. ',
    partners: 'Partenerii nu plătesc pentru poziție; primim un comision fix doar dacă deschizi și alimentezi un cont.',
    simulation: 'Simulare',
    learnMore: (name: string) => `Vreau să aflu mai multe despre ${name}`,
    note: 'Educație financiară, nu consultanță de investiții. Verifică termenii furnizorului înainte să deschizi ceva.',
  },
  {
    riskWord: { 1: 'very low', 2: 'low', 3: 'medium', 4: 'high', 5: 'very high' },
    notFound: "We couldn't find that page",
    old: 'The link may be out of date. All the options are on Home.',
    backHome: 'Back to Home',
    home: 'Home',
    risk: 'Risk',
    access: 'Access',
    tax: '2026 tax',
    where: 'Where to find it',
    brokers: 'Brokers',
    orderSavings: 'The order comes from a public formula: return after tax, then access, then name. ',
    orderBrokers: 'The order comes from a public formula: the cost of a 1,000 lei order (fee plus the currency spread), then name. ',
    partners: "Partners don't pay for their position; we earn a fixed fee only if you open and fund an account.",
    simulation: 'Simulation',
    learnMore: (name) => `Tell me more about ${name}`,
    note: "Financial education, not investment advice. Check the provider's terms before you open anything.",
  },
);

export default async function AssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const [data, lang] = await Promise.all([getAsset(assetId), getLang()]);
  const t = T[lang];

  if (!data) {
    return (
      <main className="shell">
        <Back label={t.home} />
        <h1>{t.notFound}</h1>
        <p className="muted">{t.old}</p>
        <Link href="/acasa" className="btn btn-primary">
          {t.backHome}
        </Link>
        <TabBar current="acasa" />
      </main>
    );
  }

  const { asset, providers, providerKind, inflationPct } = data;
  const best = providers[0];

  return (
    <main className="shell">
      <Back label={t.home} />
      <header className="stack" style={{ gap: 8 }}>
        <h1>{asset.name}</h1>
        <p className="muted">{asset.oneLine}</p>
      </header>

      <Card>
        <p>{asset.whatItIs}</p>
        <hr className="divider" />
        <Fact label={t.risk}>
          <RiskMeter value={asset.risk} />
          <span className="small">{t.riskWord[asset.risk]}</span>
        </Fact>
        <Fact label={t.access}>{asset.access}</Fact>
        <Fact label={t.tax}>{asset.tax}</Fact>
      </Card>

      <section className="section" aria-labelledby="unde">
        <h2 id="unde" className="section-title">
          {providerKind === 'savings' ? t.where : t.brokers}
        </h2>
        <Card style={{ gap: 0 }}>
          {providers.map((p) => (
            <ProviderRow key={p.id} p={p} />
          ))}
        </Card>
        <p className="note">
          {providerKind === 'savings' ? t.orderSavings : t.orderBrokers}
          {t.partners}
        </p>
      </section>

      <section className="section" aria-labelledby="simulare">
        <h2 id="simulare" className="section-title">
          {t.simulation}
        </h2>
        <Card>
          <Simulation basis={asset.simulation} ratePct={best?.netRatePct} inflationPct={inflationPct} />
        </Card>
      </section>

      <Link href={`/moment/lib/${asset.momentId}`} className="btn btn-primary btn-block">
        {t.learnMore(asset.name.split(' (')[0].toLowerCase())}
      </Link>
      <p className="note">{t.note}</p>
      <TabBar current="acasa" />
    </main>
  );
}

function Back({ label }: { label: string }) {
  return (
    <Link href="/acasa" className="link-back">
      <Icon name="back" size={18} /> {label}
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
