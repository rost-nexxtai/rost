import Link from 'next/link';
import { LibraryMomentPlayer } from '@/components/moments/LibraryMomentPlayer';
import { getAsset, getProfile } from '@/data';
import { LIBRARY } from '@/data/fixtures/moments';
import { CORE_MOMENTS } from '@/data/mock/scoring';
import type { Asset } from '@/data/types';

export const dynamic = 'force-dynamic';

export default async function LibraryMomentPage({ params }: { params: Promise<{ momentId: string }> }) {
  const { momentId } = await params;
  const moment = LIBRARY.find((m) => m.id === momentId);

  if (!moment || moment.steps.length === 0) {
    return (
      <main className="shell shell-bare">
        <span className="eyebrow">{moment ? `${moment.series} · ${moment.minutes} min` : 'Momente'}</span>
        <h1>{moment ? moment.title : 'Nu am găsit lecția'}</h1>
        <p className="muted">{moment ? 'Lecția asta e în lucru. Revino curând.' : 'Poate linkul e vechi.'}</p>
        <Link href="/momente" className="btn btn-primary">
          Înapoi la Momente
        </Link>
      </main>
    );
  }

  const assetIds = moment.steps.flatMap((s) => (s.type === 'asset_range' ? [s.assetId] : []));
  const assets: Record<string, Asset> = {};
  for (const id of assetIds) {
    const a = await getAsset(id);
    if (a) assets[id] = a.asset;
  }
  const profile = await getProfile();
  const level = profile?.level ?? 0;
  const done = new Set([...(profile?.completedMomentIds ?? []), moment.id]);
  const coreLeftAfter = CORE_MOMENTS[level].filter((id) => !done.has(id)).length;

  return <LibraryMomentPlayer moment={moment} assets={assets} levelBefore={level} coreLeftAfter={coreLeftAfter} />;
}
