import type { LibraryMoment } from '../types';

/**
 * FIXTURE until backend ships library moments as data (backend/internal/reference/data/moments).
 * Two are written; the rest are listed so the learning path is visible, marked "în curând".
 */
export const LIBRARY: LibraryMoment[] = [
  {
    id: 'fondul_urgenta',
    title: 'Fondul de urgență',
    series: 'Fundația',
    level: 0,
    core: true,
    minutes: 4,
    assetIds: ['cont_economii'],
    steps: [
      {
        type: 'choice',
        question: 'Unde e cel mai bine să ții fondul de urgență?',
        options: ['Într-un cont de economii din care scoți banii oricând', 'Într-un depozit pe 3 ani', 'În acțiuni, ca să crească'],
        correct: 0,
        explain:
          'Fondul de urgență trebuie să fie la îndemână în aceeași zi. Un depozit te penalizează dacă îl spargi, iar acțiunile pot fi în scădere exact când ai nevoie de bani.',
      },
      {
        type: 'predict',
        question: 'Câte luni de cheltuieli ar trebui să acopere fondul tău de urgență?',
        answerValue: 3,
        min: 0,
        max: 12,
        step: 1,
        unit: 'luni',
      },
      {
        type: 'card',
        title: 'Ținta: 3 luni de cheltuieli',
        body: 'Dacă cheltui 2.500 lei pe lună, ținta e 7.500 lei. Nu trebuie strânși dintr-odată: cu 400 lei pe lună ajungi acolo în cam un an și jumătate. Dacă ai un venit nesigur (PFA, contract pe perioadă determinată), țintește spre 6 luni.',
      },
      {
        type: 'card',
        title: 'Unde îl ții',
        body: 'Într-un cont de economii separat de cel de card, ca să nu-l cheltui din greșeală. Dobânda e mică, dar rolul lui e să fie acolo, nu să crească. Abia după ce îl ai merită să te uiți la depozite, titluri de stat sau ETF-uri.',
      },
      { type: 'finish', cta: { label: 'Vezi conturile de economii', href: '/active/cont_economii' } },
    ],
  },
  { id: 'economii_vs_depozit', title: 'Cont de economii sau depozit?', series: 'Fundația', level: 0, core: true, minutes: 4, assetIds: ['cont_economii', 'depozit'], steps: [] },
  { id: 'dobanda_compusa', title: 'Dobânda la dobândă', series: 'Fundația', level: 0, core: true, minutes: 4, assetIds: ['depozit'], steps: [] },
  { id: 'titluri_stat', title: 'Titluri de stat', series: 'Investiții', level: 1, core: true, minutes: 5, assetIds: ['titluri_stat'], steps: [] },
  {
    id: 'etf',
    title: 'ETF-uri',
    series: 'Investiții',
    level: 1,
    core: true,
    minutes: 5,
    assetIds: ['etf'],
    steps: [
      {
        type: 'choice',
        question: 'Ce cumperi când cumperi un ETF pe un indice global?',
        options: ['O singură acțiune a unei companii mari', 'O bucată din sute de companii deodată', 'Un depozit în dolari'],
        correct: 1,
        explain:
          'Un ETF pe MSCI World ține acțiuni la aproximativ 1.400 de companii din țările dezvoltate. Dacă una cade, celelalte o compensează.',
      },
      {
        type: 'predict',
        question: 'Cât crezi că a scăzut MSCI World în 2008, cel mai rău an din ultimii 50?',
        answerValue: -40.33,
        min: -60,
        max: 20,
        step: 1,
        unit: '%',
      },
      { type: 'asset_range', assetId: 'etf' },
      {
        type: 'card',
        title: 'Costuri și impozit',
        body: 'Plătești un comision la broker la fiecare cumpărare și, dacă ETF-ul e în euro sau dolari, o diferență de curs. Pe câștig: 3% dacă ții peste un an sau 6% sub un an, printr-un broker din România; 16% printr-un broker străin, declarat în Declarația unică.',
      },
      {
        type: 'card',
        title: 'Pentru ce bani',
        body: 'Pentru bani de care nu ai nevoie cel puțin 5–10 ani, după ce ai fondul de urgență. Pe termen scurt poate scădea mult, ca în 2008; pe perioade lungi a crescut istoric. Asta nu e o promisiune.',
      },
      { type: 'finish', cta: { label: 'Vezi ETF-urile', href: '/active/etf' } },
    ],
  },
  { id: 'actiuni', title: 'Acțiuni', series: 'Investiții', level: 2, core: true, minutes: 5, assetIds: ['actiuni'], steps: [] },
  { id: 'aur', title: 'Aur și mărfuri', series: 'Investiții', level: 2, core: true, minutes: 5, assetIds: ['aur'], steps: [] },
];
