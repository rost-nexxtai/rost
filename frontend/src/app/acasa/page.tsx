import { redirect } from 'next/navigation';
import { AssetCard } from '@/components/acasa/AssetCard';
import { FoundationCard } from '@/components/acasa/FoundationCard';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { getAcasa } from '@/data';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const T = copy(
  {
    hello: (name?: string) => (name ? `Bună, ${name}` : 'Bună'),
    sub: 'Locurile unde îți poți ține sau crește banii, în ordinea în care merită să le înveți.',
    forLevel: 'Pentru nivelul tău',
    later: 'Mai departe',
    laterSub: 'Le poți deschide oricând. Lecțiile lor vin după ce le stăpânești pe cele de mai sus.',
    note: 'Ordinea e una de învățare, nu o recomandare de investiții. Ratele sunt cele publice ale băncilor și brokerilor, cu luna verificării lângă fiecare; titlurile de stat au dobânzile emisiunii din octombrie 2026. Verifică-le pe site-ul oficial înainte să deschizi ceva.',
  },
  {
    hello: (name) => (name ? `Hi, ${name}` : 'Hi'),
    sub: 'Where you can keep or grow your money, in the order worth learning them.',
    forLevel: 'For your level',
    later: 'Next up',
    laterSub: "You can open them any time. Their lessons come after you've got the ones above.",
    note: "The order is a learning order, not investment advice. Rates are the banks' and brokers' public ones, with the month each was checked next to it; government bonds show the October 2026 issue's rates. Check them on the official site before you open anything.",
  },
);

export default async function Acasa() {
  const [data, lang] = await Promise.all([getAcasa(), getLang()]);
  if (!data) redirect('/quiz');
  const t = T[lang];
  const { profile, foundation, forYourLevel, later } = data;

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <section className="stack" style={{ gap: 6 }}>
        <h1>{t.hello(profile.name)}</h1>
        <p className="muted">{t.sub}</p>
      </section>

      {foundation && (
        <FoundationCard
          kind={foundation}
          bufferMonths={profile.bufferMonths}
          lessonDone={profile.completedMomentIds.includes('fondul_urgenta')}
        />
      )}

      <section className="section" aria-labelledby="nivel">
        <h2 id="nivel" className="section-title">
          {t.forLevel}
        </h2>
        {forYourLevel.map((a) => (
          <AssetCard key={a.id} asset={a} />
        ))}
      </section>

      {later.length > 0 && (
        <section className="section" aria-labelledby="mai-departe">
          <h2 id="mai-departe" className="section-title">
            {t.later}
          </h2>
          <p className="section-sub">{t.laterSub}</p>
          {later.map((a) => (
            <AssetCard key={a.id} asset={a} later />
          ))}
        </section>
      )}

      <p className="note">{t.note}</p>
      <TabBar current="acasa" />
    </main>
  );
}
