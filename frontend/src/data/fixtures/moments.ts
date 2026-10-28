import type { Lang } from '@/i18n/lang';
import type { LibraryMoment } from '../types';
import { LIBRARY_EN } from './moments.en';

/**
 * FIXTURE until backend ships library moments as data (backend/internal/reference/data/moments).
 * Each lesson is 5–6 screens, one idea each, and most screens ask you to do something:
 * sort, guess on a scale, or play with a calculator. Figures are worked out in the comments.
 */
export const LIBRARY: LibraryMoment[] = [
  {
    id: 'fondul_urgenta',
    title: 'Fondul de urgență',
    hook: 'Banii care te scot din belele fără credit.',
    series: 'Fundația',
    level: 0,
    core: true,
    minutes: 3,
    assetIds: ['cont_economii'],
    steps: [
      {
        type: 'sort',
        question: 'Pe care le plătești din fondul de urgență?',
        buckets: ['Urgență', 'Poate aștepta'],
        items: [
          { label: 'Ți se strică mașina cu care mergi la job', bucket: 0 },
          { label: 'Reduceri de Black Friday', bucket: 1 },
          { label: 'Rămâi fără job', bucket: 0 },
          { label: 'Un city break cu prietenii', bucket: 1 },
          { label: 'Te doare o măsea', bucket: 0 },
        ],
        explain: 'Fondul de urgență e pentru ce nu ai plănuit și nu poți amâna. Pentru restul, strângi separat.',
      },
      {
        type: 'predict',
        question: 'Câte luni de cheltuieli ar trebui să acopere?',
        answerValue: 3,
        min: 0,
        max: 12,
        step: 1,
        start: 8,
        unit: 'luni',
        explain: 'Regula de bază e 3 luni. Dacă venitul e nesigur (PFA, contract pe perioadă determinată), țintește spre 6.',
      },
      {
        type: 'explore',
        title: 'Cât înseamnă asta pentru tine?',
        body: 'Pune cheltuielile tale și cât poți pune deoparte. Nu trebuie strânși dintr-odată.',
        widget: 'fund_builder',
      },
      {
        type: 'choice',
        question: 'Unde îl ții?',
        options: ['Într-un cont de economii, separat de card', 'Într-un depozit pe 3 ani', 'În acțiuni, ca să crească'],
        correct: 0,
        explain: 'Trebuie să-l poți scoate în aceeași zi. Un depozit te penalizează dacă îl spargi, iar acțiunile pot fi pe minus exact când ai nevoie.',
      },
      { type: 'finish', cta: { label: 'Vezi conturile de economii', href: '/active/cont_economii' } },
    ],
    takeaways: [
      'Fondul de urgență acoperă 3 luni de cheltuieli; 6 dacă venitul e nesigur.',
      'Îl ții într-un cont de economii separat, din care scoți banii oricând.',
      'Abia după el are sens să te uiți la depozite sau investiții.',
    ],
  },
  {
    id: 'economii_vs_depozit',
    title: 'Cont de economii sau depozit?',
    hook: 'Aceiași bani, dobândă diferită. Contează când ai nevoie de ei.',
    series: 'Fundația',
    level: 0,
    core: true,
    minutes: 3,
    assetIds: ['cont_economii', 'depozit'],
    steps: [
      {
        type: 'predict',
        question: 'Depozit pe un an, 10.000 lei, 5% dobândă. Cât primești, după impozit?',
        // 10.000 × 5% = 500 lei; minus 10% impozit pe dobândă = 450 lei.
        answerValue: 450,
        min: 0,
        max: 1000,
        step: 10,
        start: 800,
        unit: 'lei',
        explain: 'Dobânda e 500 lei, dar banca reține 10% impozit: rămân 450 lei.',
      },
      {
        type: 'explore',
        title: 'Când ai nevoie de bani?',
        body: 'Același 10.000 lei, două locuri. Mută sliderul.',
        widget: 'savings_vs_deposit',
      },
      {
        type: 'sort',
        question: 'Unde pui fiecare sumă?',
        buckets: ['Cont de economii', 'Depozit'],
        items: [
          { label: 'Fondul de urgență', bucket: 0 },
          { label: 'Avansul pentru o mașină, peste un an și jumătate', bucket: 1 },
          { label: 'Chiria de luna viitoare', bucket: 0 },
          { label: 'Banii pentru vacanța de vara viitoare, de care nu te atingi', bucket: 1 },
        ],
        explain: 'Bani de care ai nevoie oricând: cont de economii. Bani de care sigur nu te atingi o perioadă: depozit.',
      },
      {
        type: 'stat',
        value: '100.000 €',
        label: 'garantează statul, prin FGDB, pentru fiecare om, la fiecare bancă.',
        body: 'Și contul de economii, și depozitul sunt garantate până la suma asta. Dacă banca dă faliment, primești banii înapoi.',
      },
      { type: 'finish', cta: { label: 'Compară depozitele', href: '/active/depozit' } },
    ],
    takeaways: [
      'Pe dobânda de la bancă plătești 10% impozit.',
      'Depozitul dă mai mult, dar dacă îl spargi devreme pierzi de obicei dobânda.',
      'Ambele sunt garantate de FGDB până la 100.000 € de persoană, pe bancă.',
    ],
  },
  {
    id: 'dobanda_compusa',
    title: 'Dobânda la dobândă',
    hook: 'De ce timpul bate suma.',
    series: 'Fundația',
    level: 0,
    core: true,
    minutes: 3,
    assetIds: ['depozit'],
    steps: [
      {
        type: 'predict',
        question: 'Pui 1.000 lei la 7% pe an și nu atingi nimic. Cât ai după 10 ani?',
        // 1.000 × 1,07^10 = 1.967 lei.
        answerValue: 1967,
        min: 1000,
        max: 3000,
        step: 25,
        start: 1300,
        unit: 'lei',
        explain: 'Nu 1.700 lei (7% × 10 ani). În fiecare an primești dobândă și la dobânda de dinainte.',
      },
      {
        type: 'explore',
        title: 'Ce contează mai mult: suma sau timpul?',
        body: 'Joacă-te cu cele trei slidere și urmărește partea verde.',
        widget: 'compound',
      },
      {
        type: 'choice',
        question: 'Ana pune 200 lei pe lună de la 22 de ani. Mihai pune 400 lei pe lună de la 32. La 60 de ani, cu 6% pe an, cine are mai mult?',
        // Ana: 38 de ani × 200 lei, capitalizare lunară la 6% → ~348.900 lei, din care a pus 91.200.
        // Mihai: 28 de ani × 400 lei → ~347.500 lei, din care a pus 134.400.
        options: ['Mihai, a pus dublu pe lună', 'Aproape la fel', 'Ana, la mare distanță'],
        correct: 1,
        explain: 'Amândoi au cam 348.000 lei. Dar Ana a pus 91.200 lei, iar Mihai 134.400. Cei 10 ani în plus au făcut cât o dublare a sumei.',
      },
      {
        type: 'stat',
        value: '×2 în 3 ani',
        label: 'crește o datorie pe card la 25% pe an, dacă nu o plătești.',
        // 1,25^3 = 1,95.
        body: 'Dobânda la dobândă merge și invers. De asta datoriile scumpe se plătesc înainte să economisești.',
      },
      { type: 'finish', cta: { label: 'Vezi depozitele', href: '/active/depozit' } },
    ],
    takeaways: [
      'Dobânda la dobândă face ca anii să conteze mai mult decât suma.',
      'Să începi devreme cu puțin bate să începi târziu cu mult.',
      'La datorii merge invers: plătește-le pe cele scumpe întâi.',
    ],
  },
  {
    id: 'titluri_stat',
    title: 'Titluri de stat',
    hook: 'Împrumuți statul, fără impozit pe dobândă.',
    series: 'Investiții',
    level: 1,
    core: true,
    minutes: 3,
    assetIds: ['titluri_stat'],
    steps: [
      {
        type: 'choice',
        question: 'Ce faci, de fapt, când cumperi Tezaur sau Fidelis?',
        options: ['Cumperi o bucată dintr-o companie de stat', 'Împrumuți statul și primești dobândă', 'Deschizi un depozit la Trezorerie'],
        correct: 1,
        explain: 'Statul se împrumută de la oameni ca tine. La scadență îți dă banii înapoi, iar până atunci plătește dobândă.',
      },
      {
        type: 'predict',
        question: 'Un depozit are 8% dobândă. Cât rămâne după impozitul de 10%?',
        answerValue: 7.2,
        min: 5,
        max: 9,
        step: 0.1,
        start: 8.6,
        unit: '%',
        explain: '8% minus o zecime din el = 7,2%. Titlurile de stat nu au impozit, așa că 7,4% rămân 7,4%.',
      },
      {
        type: 'explore',
        title: 'Dobânda mai mică poate câștiga',
        widget: 'bonds_vs_deposit',
      },
      {
        type: 'sort',
        question: 'Tezaur sau Fidelis?',
        buckets: ['Tezaur', 'Fidelis'],
        items: [
          { label: 'Îl cumpăr de la Poștă sau de la Trezorerie', bucket: 0 },
          { label: 'Vreau să-l pot vinde la bursă înainte de scadență', bucket: 1 },
          { label: 'Îl cumpăr prin banca sau brokerul meu', bucket: 1 },
          { label: 'Îl țin sigur până la capăt', bucket: 0 },
        ],
        explain: 'Tezaur: de la Trezorerie, Poștă sau online, ții până la scadență. Fidelis: prin bănci și brokeri, se poate vinde la bursă, la prețul zilei.',
      },
      { type: 'finish', cta: { label: 'Vezi titlurile de stat', href: '/active/titluri_stat' } },
    ],
    takeaways: [
      'Cu titlurile de stat împrumuți statul, care îți plătește dobândă.',
      'Dobânda lor nu se impozitează, deci o rată afișată mai mică poate câștiga.',
      'Tezaur se ține până la scadență; Fidelis se poate vinde la bursă.',
    ],
  },
  {
    id: 'etf',
    title: 'ETF-uri',
    hook: 'Sute de companii dintr-o singură cumpărare.',
    series: 'Investiții',
    level: 1,
    core: true,
    minutes: 4,
    assetIds: ['etf'],
    steps: [
      {
        type: 'explore',
        title: 'O companie dă faliment. Cât pierzi?',
        body: 'Alege câte companii ai.',
        widget: 'diversify',
      },
      {
        type: 'choice',
        question: 'Ce cumperi când cumperi un ETF pe un indice global?',
        options: ['O singură acțiune a unei companii mari', 'O bucată din sute de companii deodată', 'Un depozit în dolari'],
        correct: 1,
        explain: 'Un ETF pe MSCI World ține acțiuni la aproximativ 1.400 de companii din țările dezvoltate. Dacă una cade, celelalte o compensează.',
      },
      {
        type: 'predict',
        question: 'Cât a scăzut MSCI World în 2008, cel mai rău an din ultimii 50?',
        answerValue: -40.33,
        min: -60,
        max: 20,
        step: 1,
        start: -10,
        unit: '%',
        explain: 'Diversificarea nu te scapă de ani proști ai pieței întregi. De asta în ETF-uri pui doar bani de care nu ai nevoie 5–10 ani.',
      },
      { type: 'asset_range', assetId: 'etf' },
      {
        type: 'stat',
        value: '3%',
        label: 'impozit pe câștig dacă ții ETF-ul peste un an, printr-un broker din România.',
        body: 'Sub un an: 6%. Printr-un broker străin: 16%, declarat de tine în Declarația unică.',
      },
      { type: 'finish', cta: { label: 'Vezi ETF-urile', href: '/active/etf' } },
    ],
    takeaways: [
      'Un ETF împarte riscul între sute de companii.',
      'Piața întreagă poate scădea mult într-un an, ca în 2008.',
      'Doar pentru bani de care nu ai nevoie cel puțin 5–10 ani, după fondul de urgență.',
    ],
  },
  { id: 'actiuni', title: 'Acțiuni', hook: 'O bucată dintr-o companie.', series: 'Investiții', level: 2, core: true, minutes: 4, assetIds: ['actiuni'], steps: [], takeaways: [] },
  { id: 'aur', title: 'Aur și mărfuri', hook: 'Protecție în crize, fără dobândă.', series: 'Investiții', level: 2, core: true, minutes: 4, assetIds: ['aur'], steps: [], takeaways: [] },
];

/** The lessons in the visitor's language. Romanian is the source; English mirrors it (moments.en.ts). */
export const libraryFor = (lang: Lang): LibraryMoment[] => (lang === 'en' ? LIBRARY_EN : LIBRARY);
