import type { Level, RiskProfile } from '@/data/types';
import { copy } from './lang';

/** Names shared across screens: levels and risk profiles. The data keeps the Romanian keys. */
export const TERMS = copy(
  {
    level: { 0: 'Începător', 1: 'Mediu', 2: 'Avansat' } as Record<Level, string>,
    risk: { prudent: 'prudent', echilibrat: 'echilibrat', dinamic: 'dinamic' } as Record<RiskProfile, string>,
    riskLine: {
      prudent: 'Pui siguranța pe primul loc',
      echilibrat: 'Un pic de risc, pentru mai mult randament',
      dinamic: 'Accepți scăderi pe termen scurt',
    } as Record<RiskProfile, string>,
    // Why the quiz placed you where it did (docs/level-assessment.md).
    placement: {
      0: 'Începem cu bazele: inflația și dobânda la dobândă',
      1: 'Știi bazele, așa că sari peste ele',
      2: 'Știi bazele, diversificarea și obligațiunile',
    } as Record<Level, string>,
  },
  {
    level: { 0: 'Beginner', 1: 'Intermediate', 2: 'Advanced' },
    risk: { prudent: 'cautious', echilibrat: 'balanced', dinamic: 'adventurous' },
    riskLine: {
      prudent: 'Safety comes first',
      echilibrat: 'A little risk, for a better return',
      dinamic: 'You can live with short-term drops',
    },
    placement: {
      0: 'We start with the basics: inflation and interest on interest',
      1: 'You know the basics, so you skip them',
      2: 'You know the basics, diversification and bonds',
    },
  },
);
