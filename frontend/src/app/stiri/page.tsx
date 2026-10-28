import { redirect } from 'next/navigation';
import { NewsCard } from '@/components/stiri/NewsCard';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { getProfile, getStiri } from '@/data';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

const T = copy(
  { title: 'Știri', sub: 'Ce se întâmplă în lume și cât te costă, pe cifrele tale.', note: 'Selectate și verificate de un editor. Nu facem predicții despre prețuri sau piețe.' },
  { title: 'News', sub: "What's happening in the world and what it costs you, on your own numbers.", note: "Picked and checked by an editor. We don't predict prices or markets." },
);

export const dynamic = 'force-dynamic';

export default async function Stiri() {
  const [data, profile, lang] = await Promise.all([getStiri(), getProfile(), getLang()]);
  if (!data || !profile) redirect('/quiz');
  const t = T[lang];

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <section className="stack" style={{ gap: 6 }}>
        <h1>{t.title}</h1>
        <p className="muted">{t.sub}</p>
      </section>
      {data.items.map((item) => (
        <NewsCard key={item.id} item={item} money={data.money} />
      ))}
      <p className="note">{t.note}</p>
      <TabBar current="stiri" />
    </main>
  );
}
