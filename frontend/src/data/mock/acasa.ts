// MOCK until backend ships GET /api/acasa.
import { pct } from '@/lib/format';
import { ASSETS } from '../fixtures/assets';
import { BROKERS } from '../fixtures/brokers';
import { SAVINGS } from '../fixtures/providers';
import type { AcasaResponse, Asset, AssetCard, Profile, RiskProfile } from '../types';
import { rankBrokers, rankSavings } from './ranking';
import { foundationFor } from './scoring';

/** Highest asset risk (1–5) that sits within each risk profile. Above it, the card says so; it never hides. */
export function maxRiskFor(r: RiskProfile): number {
  return r === 'prudent' ? 2 : r === 'echilibrat' ? 3 : 5;
}

export function headlineFor(a: Asset): string {
  if (a.simulation.kind === 'fixed') {
    const top = rankSavings(SAVINGS.filter((p) => p.assetId === a.id))[0];
    return top?.netRatePct !== undefined ? `până la ${pct(top.netRatePct, 2)} pe an, după impozit` : '';
  }
  if (a.id === 'aur') return `randament istoric tipic ${pct(a.simulation.typicalPct, 2)} pe an`;
  const cheapest = rankBrokers(BROKERS)[0];
  return cheapest ? `costuri de la ${cheapest.headline}` : '';
}

function card(a: Asset, p: Profile): AssetCard {
  return {
    id: a.id,
    name: a.name,
    oneLine: a.oneLine,
    risk: a.risk,
    lessonLevel: a.lessonLevel,
    headline: headlineFor(a),
    aboveRiskProfile: a.risk > maxRiskFor(p.riskProfile),
  };
}

/** Every asset for every user; the level only splits "for your level" from "later", in a fixed order. */
export function buildAcasa(p: Profile): AcasaResponse {
  return {
    profile: p,
    foundation: foundationFor(p),
    forYourLevel: ASSETS.filter((a) => a.lessonLevel <= p.level).map((a) => card(a, p)),
    later: ASSETS.filter((a) => a.lessonLevel > p.level).map((a) => card(a, p)),
  };
}
