/**
 * Response shapes the frontend expects for screens the backend doesn't serve yet.
 * Each one notes the endpoint we're proposing. When the backend team agrees a shape,
 * it moves to backend/src/contract.ts and data/index.ts switches to the real call.
 */
import type { Situation } from '@backend/contract';

export type { Situation };

export type Level = 0 | 1 | 2;
export type RiskProfile = 'prudent' | 'echilibrat' | 'dinamic';
export type AgeBand = 'sub_25' | '25_29' | '30_plus';
export type MoneyHorizon = 'sub_1_an' | '1_3_ani' | 'peste_3_ani';
export type KnowledgeAnswer = number | 'nu_stiu';
export type AssetId = 'cont_economii' | 'depozit' | 'titluri_stat' | 'etf' | 'actiuni' | 'aur';
export type Foundation = 'fond_urgenta' | 'datorii_scumpe' | null;

/** Monthly money lines the Știri items read. inflationPct is personal when known, else national. */
export interface MoneyLines {
  fuelLei: number;
  electricityLei: number;
  savedLei: number;
  inflationPct: number;
}

/** proposed: GET /api/me (extend the user with this profile) */
export interface Profile {
  name?: string;
  quizScore: number;
  quizLevel: Level;
  /** max(quiz level, level earned from completed core moments) */
  level: Level;
  riskProfile: RiskProfile;
  ageBand: AgeBand;
  situation: Situation;
  bufferMonths: number;
  expensiveDebt: boolean;
  horizon: MoneyHorizon;
  money: MoneyLines;
  completedMomentIds: string[];
}

/** proposed: POST /api/quiz */
export interface QuizAnswers {
  knowledge: KnowledgeAnswer[];
  ageBand: AgeBand;
  situation: Situation;
  bufferMonths: number;
  expensiveDebt: boolean;
  horizon: MoneyHorizon;
  grossMonthly?: number;
  fuelLei?: number;
  electricityLei?: number;
  savedLei?: number;
}

export interface SavingsProvider {
  id: string;
  assetId: 'cont_economii' | 'depozit' | 'titluri_stat';
  name: string;
  product: string;
  kind: 'deposit' | 'state_bond';
  grossRatePct: number;
  termMonths: number;
  /** 1 any time, 2 lose the interest if you break it, 3 locked until maturity */
  accessRank: 1 | 2 | 3;
  isPartner: boolean;
  example: boolean;
  /** Offer id in backend/data/seed/offers.json; set only when a real referral link exists. */
  offerId?: string;
}

export interface Broker {
  id: string;
  name: string;
  country: 'RO' | 'EU';
  commissionPct: number;
  minCommissionLei: number;
  spreadPct: number;
  isPartner: boolean;
  example: true;
}

export interface RankedProvider {
  id: string;
  rank: number;
  name: string;
  product: string;
  headline: string;
  netRatePct?: number;
  costLei?: number;
  accessRank?: 1 | 2 | 3;
  isPartner: boolean;
  example: boolean;
  offerId?: string;
}

export interface Point {
  year: number;
  valueLei: number;
}

export interface SimInput {
  startLei: number;
  monthlyLei: number;
  years: number;
}

export type AssetSimulation =
  | { kind: 'fixed' }
  | {
      kind: 'range';
      worstPct: number;
      typicalPct: number;
      bestPct: number;
      worstYear: { year: number; pct: number };
      source: { label: string; url: string };
      note?: string;
    };

export interface Asset {
  id: AssetId;
  name: string;
  oneLine: string;
  lessonLevel: Level;
  risk: 1 | 2 | 3 | 4 | 5;
  access: string;
  tax: string;
  whatItIs: string;
  momentId: string;
  simulation: AssetSimulation;
}

export interface AssetCard {
  id: AssetId;
  name: string;
  oneLine: string;
  risk: 1 | 2 | 3 | 4 | 5;
  lessonLevel: Level;
  headline: string;
  aboveRiskProfile: boolean;
}

/** proposed: GET /api/acasa */
export interface AcasaResponse {
  profile: Profile;
  foundation: Foundation;
  forYourLevel: AssetCard[];
  later: AssetCard[];
}

/** proposed: GET /api/assets/:id */
export interface AssetResponse {
  asset: Asset;
  /** Ranked by the public formula: savings by net rate after tax, brokers by the cost of a 1,000 lei order. */
  providers: RankedProvider[];
  providerKind: 'savings' | 'brokers';
  /** The user's inflation (personal when known), for "in today's money". */
  inflationPct: number;
}
