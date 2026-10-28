import type { NewsItem } from '../types';

/**
 * FIXTURE until backend ships GET /api/stiri (editor-approved items). Facts as of 28 October 2026,
 * each from a named, dated source. The user's figure is always a scenario, never a forecast.
 */
export const NEWS: NewsItem[] = [
  {
    id: 'motorina',
    date: '28 oct. 2026',
    title: 'Petrolul rămâne scump, iar reducerea de acciză la motorină se termină pe 31 octombrie',
    facts: [
      'Brent: 114,22 dolari pe baril pe 27 octombrie.',
      'Benzina costă 10,10 lei/L, motorina 10,90 lei/L. Acum un an: 7,46 și 7,66 lei/L.',
      'Fără reducerea de acciză, motorina ar putea crește cu aproximativ 0,85 lei/L.',
      'Petrolul a urcat odată cu războiul din Iran, început pe 28 februarie 2026.',
    ],
    sources: [
      {
        label: 'Ziarul Profit: prețurile de azi',
        url: 'https://www.ziarulprofit.ro/pret-carburanti-28-octombrie-2026-benzina-a-sazut-sub-10-lei-la-unele-statii/',
        date: '28 oct. 2026',
      },
      {
        label: 'Ziarul Profit: comparația cu 2025',
        url: 'https://www.ziarulprofit.ro/preturile-carburantilor-au-explodat-in-romania-cat-costa-un-plin-de-benzina-sau-motorina-comparativ-cu-2025-si-cum-se-schimba-pretul-produselor-de-la-raft-din-aceasta-cauza/',
        date: '28 oct. 2026',
      },
      { label: 'Wikipedia: impactul economic al războiului', url: 'https://en.wikipedia.org/wiki/Economic_impact_of_the_2026_Iran_war', date: '2026' },
    ],
    impact: { kind: 'spend', line: 'fuelLei', shock: { defaultPct: 8, minPct: 0, maxPct: 25 } },
    momentId: 'fondul_urgenta',
    momentHref: '/moment/lib/fondul_urgenta',
  },
  {
    id: 'electricitate',
    date: '7 oct. 2026',
    title: 'Facturile la curent ar putea crește cu 20–22% în iarna și primăvara asta',
    facts: [
      'Estimarea vine de la secretarul de stat din Ministerul Energiei.',
      'Gazele pentru populație au preț reglementat, așa că acolo nu se așteaptă creșteri.',
    ],
    sources: [
      {
        label: 'Capital: facturile în iarna 2026–2027',
        url: 'https://www.capital.ro/facturile-la-gaze-si-energie-electrica-in-iarna-2026-2027-vor-exista-si-scumpiri-cu-peste-20.html',
        date: '7 oct. 2026',
      },
    ],
    impact: { kind: 'spend', line: 'electricityLei', shock: { defaultPct: 20, minPct: 0, maxPct: 35 } },
    momentId: 'personal_inflation',
    momentHref: '/momente',
  },
  {
    id: 'bnr',
    date: '8 oct. 2026',
    title: 'BNR ține dobânda la 6,50% și se așteaptă ca inflația să crească din nou',
    facts: [
      'Decizia din 8 octombrie: a opta ședință la rând fără schimbare.',
      'Motivele: carburanții, energia, seceta severă, conflictul din Orientul Mijlociu, un leu mai slab.',
      'Erste/BCR nu se așteaptă la o scădere a dobânzii înainte de mai 2027.',
    ],
    sources: [{ label: 'Bankingnews: BNR menține dobânda la 6,50%', url: 'https://bankingnews.ro/bnr-mentine-dobanda-cheie-la-650.html', date: '8 oct. 2026' }],
    impact: { kind: 'savings', alternative: { label: 'Tezaur la 1 an', ratePct: 6.5 } },
    momentId: 'titluri_stat',
    momentHref: '/moment/lib/titluri_stat',
  },
];
