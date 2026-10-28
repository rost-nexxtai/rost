import type { Level } from './profile';

/** Example data only. Rates and providers are illustrative, not live offers. */

export interface Asset {
  id: string;
  name: string;
  /** Lowest level this asset is recommended for. All assets are shown to everyone, in priority order. */
  level: Level;
  risk: 'scăzut' | 'mediu' | 'ridicat';
  description: string;
  rateLabel: string;
  providers: { name: string; ratePct: number }[];
  momentId: string;
}

export const ASSETS: Asset[] = [
  {
    id: 'savings',
    name: 'Cont de economii',
    level: 0,
    risk: 'scăzut',
    description: 'Banii rămân disponibili oricând. Dobândă mică, impozit 10% pe dobândă.',
    rateLabel: 'Dobândă brută',
    providers: [
      { name: 'Banca A', ratePct: 3.8 },
      { name: 'Banca B', ratePct: 3.5 },
    ],
    momentId: 'inflation',
  },
  {
    id: 'deposit',
    name: 'Depozit la termen',
    level: 0,
    risk: 'scăzut',
    description: 'Blochezi banii pentru o perioadă (ex. 12 luni) și primești o dobândă fixă.',
    rateLabel: 'Dobândă brută, 12 luni',
    providers: [
      { name: 'Banca A', ratePct: 5.25 },
      { name: 'Banca B', ratePct: 4.8 },
      { name: 'Banca C', ratePct: 4.4 },
    ],
    momentId: 'deposit',
  },
  {
    id: 'fidelis',
    name: 'Titluri de stat',
    level: 1,
    risk: 'scăzut',
    description: 'Împrumuți statul (Fidelis, Tezaur). Dobânda nu se impozitează.',
    rateLabel: 'Dobândă, fără impozit',
    providers: [
      { name: 'Fidelis, 2 ani', ratePct: 7.6 },
      { name: 'Tezaur, 1 an', ratePct: 7.4 },
    ],
    momentId: 'bonds',
  },
  {
    id: 'etf',
    name: 'ETF-uri',
    level: 1,
    risk: 'mediu',
    description: 'Un singur titlu care conține zeci sau sute de companii. Valoarea urcă și coboară.',
    rateLabel: 'Randament istoric mediu/an',
    providers: [
      { name: 'ETF global (Broker A)', ratePct: 8 },
      { name: 'ETF BET (Broker B)', ratePct: 9 },
    ],
    momentId: 'etf',
  },
  {
    id: 'stocks',
    name: 'Acțiuni',
    level: 2,
    risk: 'ridicat',
    description: 'Cumperi o parte dintr-o companie. Poți câștiga mult sau pierde mult.',
    rateLabel: 'Randament istoric mediu/an',
    providers: [{ name: 'Acțiuni BVB (Broker A)', ratePct: 10 }],
    momentId: 'stocks',
  },
  {
    id: 'commodities',
    name: 'Mărfuri (aur)',
    level: 2,
    risk: 'ridicat',
    description: 'Aur, petrol și alte materii prime. Nu plătesc dobândă; câștigi doar dacă prețul crește.',
    rateLabel: 'Randament istoric mediu/an',
    providers: [{ name: 'ETF aur (Broker B)', ratePct: 6 }],
    momentId: 'commodities',
  },
];

/** Assets the user's level covers come first, then the rest by level. */
export function assetsInPriority(level: Level): Asset[] {
  return [...ASSETS].sort((a, b) => Number(a.level > level) - Number(b.level > level) || a.level - b.level);
}

export interface Moment {
  id: string;
  title: string;
  level: Level;
  minutes: number;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export const MOMENTS: Moment[] = [
  {
    id: 'inflation',
    title: 'Inflația și economiile tale',
    level: 0,
    minutes: 3,
    question: 'Ai 10.000 lei în cont curent, fără dobândă, iar inflația e 6%. Cât „valorează” peste un an?',
    options: ['10.000 lei', 'Cam 9.430 lei', 'Cam 10.600 lei'],
    correct: 1,
    explanation: 'Suma rămâne 10.000 lei, dar cu ea cumperi cât cu ~9.430 lei azi: 10.000 ÷ 1,06.',
  },
  {
    id: 'deposit',
    title: 'Cum funcționează un depozit',
    level: 0,
    minutes: 3,
    question: 'Un depozit de 5% brut, cu impozit 10% pe dobândă. Cât câștigi net la 1.000 lei într-un an?',
    options: ['50 lei', '45 lei', '40 lei'],
    correct: 1,
    explanation: 'Dobânda brută e 50 lei; statul reține 10% (5 lei), deci rămân 45 lei.',
  },
  {
    id: 'bonds',
    title: 'Titlurile de stat, pe scurt',
    level: 1,
    minutes: 4,
    question: 'De ce poate o dobândă de 7,4% la Tezaur să bată un depozit de 7,8%?',
    options: ['Tezaur nu se impozitează', 'Tezaur are comision zero', 'Nu poate'],
    correct: 0,
    explanation: 'Depozitul pierde 10% din dobândă la impozit: 7,8% devine ~7,02%. Tezaur rămâne 7,4%.',
  },
  {
    id: 'etf',
    title: 'Ce este un ETF',
    level: 1,
    minutes: 4,
    question: 'Ce câștigi cumpărând un ETF în loc de acțiunile unei singure companii?',
    options: ['Dobândă garantată', 'Diversificare: riscul e împărțit pe multe companii', 'Fără impozit'],
    correct: 1,
    explanation: 'Un ETF conține multe companii, așa că o singură firmă care scade te afectează mai puțin.',
  },
  {
    id: 'stocks',
    title: 'Acțiuni: risc și diversificare',
    level: 2,
    minutes: 5,
    question: 'O acțiune scade cu 50%. Cu cât trebuie să crească pentru a reveni la prețul inițial?',
    options: ['50%', '75%', '100%'],
    correct: 2,
    explanation: 'De la 100 la 50 e −50%. De la 50 înapoi la 100 e +100%. Pierderile mari se recuperează greu.',
  },
  {
    id: 'commodities',
    title: 'Aurul și mărfurile',
    level: 2,
    minutes: 4,
    question: 'Cum câștigi bani dintr-un gram de aur?',
    options: ['Din dobânda plătită anual', 'Doar dacă prețul crește când vinzi', 'Din dividende'],
    correct: 1,
    explanation: 'Aurul nu plătește dobândă sau dividende. Câștigul vine doar din diferența de preț.',
  },
];

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  impact: string;
  levels: Level[];
}

export const NEWS: NewsItem[] = [
  {
    id: 'oil',
    title: 'Tensiuni în Orientul Mijlociu: petrolul se scumpește',
    summary: 'Un conflict în zonă poate reduce oferta de petrol și ridica prețurile la nivel global.',
    impact: 'Carburanții și transportul se pot scumpi. Verifică dacă rezerva ta de urgență acoperă 3 luni la prețuri mai mari.',
    levels: [0, 1, 2],
  },
  {
    id: 'rates',
    title: 'Băncile centrale mențin dobânzile ridicate',
    summary: 'Dobânzile mari fac creditele mai scumpe, dar depozitele și titlurile de stat aduc mai mult.',
    impact: 'Un moment bun să compari depozitele cu titlurile de stat, după impozit.',
    levels: [0, 1],
  },
  {
    id: 'markets',
    title: 'Bursele scad după date economice slabe',
    summary: 'Indicii majori au scăzut câteva procente într-o săptămână.',
    impact: 'Dacă ai ETF-uri sau acțiuni, scăderile scurte sunt normale. Contează orizontul tău, nu o săptămână.',
    levels: [1, 2],
  },
];
