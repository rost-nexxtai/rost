// MOCK until backend ships GET /api/acasa. Provider headlines come from GET /api/providers.
import type { AssetProvidersResponse } from '@/contract';
import { pct } from '@/lib/format';
import { copy, type Lang } from '@/i18n/lang';
import { assetsFor } from '../fixtures/en';
import { providersHeadline } from '../providers';
import type { AcasaResponse, Asset, AssetCard, Profile, RiskProfile } from '../types';
import { foundationFor } from './scoring';

/** Highest asset risk (1–5) that sits within each risk profile. Above it, the card says so; it never hides. */
export function maxRiskFor(r: RiskProfile): number {
  return r === 'prudent' ? 2 : r === 'echilibrat' ? 3 : 5;
}

const T = copy(
  { typical: (rate: string) => `randament istoric tipic ${rate} pe an` },
  { typical: (rate) => `typical historical return ${rate} a year` },
);

/** Empty when the backend's providers aren't there: the card still shows, without the line. */
export function headlineFor(a: Asset, lang: Lang = 'ro', providers: AssetProvidersResponse[] = []): string {
  if (a.id === 'aur' && a.simulation.kind === 'range') return T[lang].typical(pct(a.simulation.typicalPct, 2, lang));
  return providersHeadline(
    providers.find((x) => x.assetId === a.id),
    lang,
  );
}

function card(a: Asset, p: Profile, lang: Lang, providers: AssetProvidersResponse[]): AssetCard {
  return {
    id: a.id,
    name: a.name,
    oneLine: a.oneLine,
    risk: a.risk,
    lessonLevel: a.lessonLevel,
    headline: headlineFor(a, lang, providers),
    aboveRiskProfile: a.risk > maxRiskFor(p.riskProfile),
  };
}

/** Every asset for every user; the level only splits "for your level" from "later", in a fixed order. */
export function buildAcasa(p: Profile, lang: Lang = 'ro', providers: AssetProvidersResponse[] = []): AcasaResponse {
  const assets = assetsFor(lang);
  return {
    profile: p,
    foundation: foundationFor(p),
    forYourLevel: assets.filter((a) => a.lessonLevel <= p.level).map((a) => card(a, p, lang, providers)),
    later: assets.filter((a) => a.lessonLevel > p.level).map((a) => card(a, p, lang, providers)),
  };
}
