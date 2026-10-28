import { redirect } from 'next/navigation';
import { NewsCard } from '@/components/stiri/NewsCard';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { getProfile, getStiri } from '@/data';

export const dynamic = 'force-dynamic';

export default async function Stiri() {
  const [data, profile] = await Promise.all([getStiri(), getProfile()]);
  if (!data || !profile) redirect('/quiz');

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <section className="stack" style={{ gap: 6 }}>
        <h1>Știri</h1>
        <p className="muted">Ce se întâmplă în lume și cât te costă, pe cifrele tale.</p>
      </section>
      {data.items.map((item) => (
        <NewsCard key={item.id} item={item} money={data.money} />
      ))}
      <p className="note">Selectate și verificate de un editor. Nu facem predicții despre prețuri sau piețe.</p>
      <TabBar current="stiri" />
    </main>
  );
}
