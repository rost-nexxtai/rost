import Link from 'next/link';
import { LibraryMomentPlayer } from '@/components/moments/LibraryMomentPlayer';
import { getAsset, getLesson, getProfile } from '@/data';
import { ApiDown } from '@/components/ui/ApiDown';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';
import { CORE_MOMENTS } from '@/data/mock/scoring';
import type { Asset } from '@/data/types';

export const dynamic = 'force-dynamic';

const T = copy(
  { moments: 'Momente', notFound: 'Nu am găsit lecția', soon: 'Lecția asta e în lucru. Revino curând.', old: 'Poate linkul e vechi.', back: 'Înapoi la Momente', down: 'Nu putem încărca lecția acum. Încearcă din nou peste puțin.' },
  { moments: 'Moments', notFound: "We couldn't find that lesson", soon: "This lesson is still being written. Check back soon.", old: 'The link may be out of date.', back: 'Back to Moments', down: "We can't load the lesson right now. Try again in a moment." },
);

export default async function LibraryMomentPage({ params }: { params: Promise<{ momentId: string }> }) {
  const { momentId } = await params;
  const lang = await getLang();
  const t = T[lang];
  const found = await getLesson(momentId);
  if (found === 'down') {
    return (
      <main className="shell shell-bare">
        <ApiDown what={t.down} />
        <Link href="/momente" className="btn btn-primary">
          {t.back}
        </Link>
      </main>
    );
  }
  const moment = found;

  if (!moment || moment.steps.length === 0) {
    return (
      <main className="shell shell-bare">
        <span className="eyebrow">{moment ? `${moment.series} · ${moment.minutes} min` : t.moments}</span>
        <h1>{moment ? moment.title : t.notFound}</h1>
        <p className="muted">{moment ? t.soon : t.old}</p>
        <Link href="/momente" className="btn btn-primary">
          {t.back}
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

  return <LibraryMomentPlayer moment={moment} assets={assets} levelBefore={level} coreLeftAfter={coreLeftAfter} bufferMonths={profile?.bufferMonths} />;
}
