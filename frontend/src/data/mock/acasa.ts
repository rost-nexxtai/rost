// MOCK until backend ships GET /api/acasa.
import { pct } from '@/lib/format';
import { copy, type Lang } from '@/i18n/lang';
import { assetsFor, brokersFor, savingsFor } from '../fixtures/en';
import type { AcasaResponse, Asset, AssetCard, Profile, RiskProfile } from '../types';
import { rankBrokers, rankSavings } from './ranking';
import { foundationFor } from './scoring';

/** Highest asset risk (1–5) that sits within each risk profile. Above it, the card says so; it never hides. */
export function maxRiskFor(r: RiskProfile): number {
  return r === 'prudent' ? 2 : r === 'echilibrat' ? 3 : 5;
}

const T = copy(
  {
    upTo: (rate: string) => `până la ${rate} pe an, după impozit`,
    typical: (rate: string) => `randament istoric tipic ${rate} pe an`,
    costsFrom: (headline: string) => `costuri de la ${headline}`,
  },
  {
    upTo: (rate) => `up to ${rate} a year, after tax`,
    typical: (rate) => `typical historical return ${rate} a year`,
    costsFrom: (headline) => `costs from ${headline}`,
  },
);

export function headlineFor(a: Asset, lang: Lang = 'ro'): string {
  const t = T[lang];
  if (a.simulation.kind === 'fixed') {
    const top = rankSavings(savingsFor(lang).filter((p) => p.assetId === a.id), lang)[0];
    return top?.netRatePct !== undefined ? t.upTo(pct(top.netRatePct, 2, lang)) : '';
  }
  if (a.id === 'aur') return t.typical(pct(a.simulation.typicalPct, 2, lang));
  const cheapest = rankBrokers(brokersFor(lang), lang)[0];
  return cheapest ? t.costsFrom(cheapest.headline) : '';
}

function card(a: Asset, p: Profile, lang: Lang): AssetCard {
  return {
    id: a.id,
    name: a.name,
    oneLine: a.oneLine,
    risk: a.risk,
    lessonLevel: a.lessonLevel,
    headline: headlineFor(a, lang),
    aboveRiskProfile: a.risk > maxRiskFor(p.riskProfile),
  };
}

/** Every asset for every user; the level only splits "for your level" from "later", in a fixed order. */
export function buildAcasa(p: Profile, lang: Lang = 'ro'): AcasaResponse {
  const assets = assetsFor(lang);
  return {
    profile: p,
    foundation: foundationFor(p),
    forYourLevel: assets.filter((a) => a.lessonLevel <= p.level).map((a) => card(a, p, lang)),
    later: assets.filter((a) => a.lessonLevel > p.level).map((a) => card(a, p, lang)),
  };
}
