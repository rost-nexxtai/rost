import { redirect } from 'next/navigation';
import { AssetCard } from '@/components/acasa/AssetCard';
import { FoundationCard } from '@/components/acasa/FoundationCard';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { getAcasa } from '@/data';

export const dynamic = 'force-dynamic';

export default async function Acasa() {
  const data = await getAcasa();
  if (!data) redirect('/quiz');
  const { profile, foundation, forYourLevel, later } = data;

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <section className="stack" style={{ gap: 6 }}>
        <h1>{profile.name ? `Bună, ${profile.name}` : 'Bună'}</h1>
        <p className="muted">Locurile unde îți poți ține sau crește banii, în ordinea în care merită să le înveți.</p>
      </section>

      {foundation && <FoundationCard kind={foundation} bufferMonths={profile.bufferMonths} />}

      <section className="section" aria-labelledby="nivel">
        <h2 id="nivel" className="section-title">
          Pentru nivelul tău
        </h2>
        {forYourLevel.map((a) => (
          <AssetCard key={a.id} asset={a} />
        ))}
      </section>

      {later.length > 0 && (
        <section className="section" aria-labelledby="mai-departe">
          <h2 id="mai-departe" className="section-title">
            Mai departe
          </h2>
          <p className="section-sub">Le poți deschide oricând. Lecțiile lor vin după ce le stăpânești pe cele de mai sus.</p>
          {later.map((a) => (
            <AssetCard key={a.id} asset={a} later />
          ))}
        </section>
      )}

      <p className="note">
        Ordinea e una de învățare, nu o recomandare de investiții. Ratele bancare sunt exemple; titlurile de stat au dobânzile emisiunii din
        octombrie 2026.
      </p>
      <TabBar current="acasa" />
    </main>
  );
}
