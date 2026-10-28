import type { Asset } from '../types';

const MARKET_TAX =
  '3% din câștig dacă ții peste un an, 6% sub un an, reținut de un broker din România. Prin broker străin: 16%, declarat în Declarația unică.';

const MSCI_WORLD = {
  worstPct: -0.19,
  typicalPct: 10.15,
  bestPct: 19.92,
  worstYear: { year: 2008, pct: -40.33 },
  source: { label: 'MSCI World, randamente anuale 1970–2025', url: 'https://en.wikipedia.org/wiki/MSCI_World' },
};

/** FIXTURE until backend ships GET /api/assets. Fixed learning order: safest and simplest first. */
export const ASSETS: Asset[] = [
  {
    id: 'cont_economii',
    name: 'Cont de economii',
    oneLine: 'Bani la îndemână, cu o dobândă mică.',
    lessonLevel: 0,
    risk: 1,
    access: 'Oricând, fără penalizări',
    tax: '10% impozit pe dobândă, reținut de bancă',
    whatItIs:
      'Un cont la bancă din care scoți banii oricând. Dobânda e mică și se poate schimba, dar e locul potrivit pentru fondul de urgență. Depozitele sunt garantate de FGDB până la 100.000 de euro de persoană, pe bancă.',
    momentId: 'fondul_urgenta',
    simulation: { kind: 'fixed' },
  },
  {
    id: 'depozit',
    name: 'Depozit la termen',
    oneLine: 'Dobândă fixă, dacă nu atingi banii o perioadă.',
    lessonLevel: 0,
    risk: 1,
    access: 'La termen. Dacă îl spargi mai devreme, pierzi de obicei dobânda',
    tax: '10% impozit pe dobândă, reținut de bancă',
    whatItIs:
      'Blochezi o sumă pentru 1, 3, 6, 12 luni sau mai mult și primești o dobândă fixă. Garantat de FGDB până la 100.000 de euro de persoană, pe bancă.',
    momentId: 'economii_vs_depozit',
    simulation: { kind: 'fixed' },
  },
  {
    id: 'titluri_stat',
    name: 'Titluri de stat (Tezaur, Fidelis)',
    oneLine: 'Împrumuți statul și primești dobândă fără impozit.',
    lessonLevel: 1,
    risk: 1,
    access: 'Tezaur: până la scadență. Fidelis: se poate vinde la bursă, la prețul zilei',
    tax: 'Fără impozit pe dobândă',
    whatItIs:
      'Statul român se împrumută de la oameni ca tine, lunar. Tezaur se cumpără de la Trezorerie, Poștă sau online; Fidelis prin bănci și brokeri, în perioada de subscriere.',
    momentId: 'titluri_stat',
    simulation: { kind: 'fixed' },
  },
  {
    id: 'etf',
    name: 'ETF-uri pe indici',
    oneLine: 'Sute de companii într-o singură cumpărare.',
    lessonLevel: 1,
    risk: 3,
    access: 'Vinzi oricând la bursă, la prețul zilei. Prețul poate fi mai mic decât ai plătit',
    tax: MARKET_TAX,
    whatItIs:
      'Un fond care urmărește un indice, de exemplu cele mai mari ~1.400 de companii din țările dezvoltate (MSCI World). Îl cumperi printr-un broker, ca pe o acțiune.',
    momentId: 'etf',
    simulation: { kind: 'range', ...MSCI_WORLD },
  },
  {
    id: 'actiuni',
    name: 'Acțiuni',
    oneLine: 'Bucăți din companii: pot crește mult sau pot ajunge la zero.',
    lessonLevel: 2,
    risk: 5,
    access: 'Vinzi oricând la bursă, la prețul zilei',
    tax: MARKET_TAX,
    whatItIs:
      'O acțiune e o parte dintr-o singură companie. Câștigi dacă firma crește și plătește dividende; pierzi dacă îi merge rău. Mai multe companii împart riscul.',
    momentId: 'actiuni',
    simulation: {
      kind: 'range',
      ...MSCI_WORLD,
      note: 'Graficul arată o piață întreagă. O singură companie poate ajunge la zero; BET a pierdut 70% în 2008.',
    },
  },
  {
    id: 'aur',
    name: 'Aur și mărfuri',
    oneLine: 'Protecție în crize, fără dobândă și cu ani grei.',
    lessonLevel: 2,
    risk: 4,
    access: 'Prin ETF-uri pe aur, la bursă; aurul fizic se vinde mai greu și cu costuri',
    tax: MARKET_TAX,
    whatItIs:
      'Aurul nu plătește dobândă. Prețul lui crește adesea când piețele se sperie și scade în anii liniștiți. Mărfurile (petrol, metale) se mișcă și mai brusc.',
    momentId: 'aur',
    simulation: {
      kind: 'range',
      worstPct: 0.47,
      typicalPct: 5.11,
      bestPct: 14.61,
      worstYear: { year: 2013, pct: -28.3 },
      source: { label: 'Aur (GLD), randamente anuale 2005–2025', url: 'https://chartrow.com/gold/returns' },
    },
  },
];
