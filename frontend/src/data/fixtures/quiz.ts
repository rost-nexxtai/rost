import type { AgeBand, MoneyHorizon, Situation } from '../types';

export interface KnowledgeQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explain: string;
}

/** FIXTURE until backend ships POST /api/quiz. "Nu știu" is added by the UI to every question. */
export const QUIZ = {
  knowledge: [
    {
      id: 'inflatie',
      question: 'Ții 1.000 lei în casă. Inflația e 6% pe an. Peste un an, cu banii ăștia poți cumpăra…',
      options: ['Mai mult decât azi', 'La fel ca azi', 'Mai puțin decât azi'],
      correct: 2,
      explain: 'Prețurile cresc, suma rămâne aceeași, deci cumperi mai puțin.',
    },
    {
      id: 'dobanda_compusa',
      question: 'Pui 1.000 lei la 10% pe an și nu scoți nimic. Cât ai după 2 ani?',
      options: ['Exact 1.200 lei', 'Mai mult de 1.200 lei', 'Mai puțin de 1.200 lei'],
      correct: 1,
      explain: 'În anul al doilea primești dobândă și la dobânda din primul an: 1.210 lei.',
    },
    {
      id: 'actiune_vs_etf',
      question: 'Ce e, de regulă, mai riscant?',
      options: ['Acțiunile unei singure companii', 'Un ETF pe un indice cu sute de companii', 'Sunt la fel de riscante'],
      correct: 0,
      explain: 'O companie poate ajunge la zero. Un indice larg împarte riscul între sute de companii.',
    },
    {
      id: 'impozit_titluri',
      question: 'Cât impozit plătești pe dobânda de la titlurile de stat Tezaur și Fidelis?',
      options: ['10%', 'Nimic, sunt scutite', '16%'],
      correct: 1,
      explain: 'Dobânda la titlurile de stat pentru populație nu se impozitează.',
    },
    {
      id: 'obligatiuni_dobanzi',
      question: 'Dacă dobânzile cresc, prețul obligațiunilor deja emise de obicei…',
      options: ['Crește', 'Scade', 'Rămâne la fel'],
      correct: 1,
      explain: 'Obligațiunile noi plătesc mai mult, așa că cele vechi valorează mai puțin.',
    },
    {
      id: 'ce_e_etf',
      question: 'Ce este un ETF?',
      options: [
        'Un cont de economii cu dobândă fixă',
        'Un fond care urmărește un coș de active și se cumpără la bursă',
        'O singură acțiune la o companie mare',
      ],
      correct: 1,
      explain: 'Un ETF urmărește un indice sau un coș de active și se tranzacționează ca o acțiune.',
    },
  ] satisfies KnowledgeQuestion[],

  profile: {
    ageBand: [
      { value: 'sub_25', label: 'Sub 25 de ani' },
      { value: '25_29', label: '25–29 de ani' },
      { value: '30_plus', label: '30 de ani sau peste' },
    ] satisfies { value: AgeBand; label: string }[],
    situation: [
      { value: 'student', label: 'Studiez' },
      { value: 'graduate', label: 'Abia am terminat școala' },
      { value: 'employed', label: 'Sunt angajat(ă)' },
      { value: 'freelance', label: 'Lucrez pe cont propriu (PFA)' },
      { value: 'between_jobs', label: 'Sunt între joburi' },
    ] satisfies { value: Situation; label: string }[],
    bufferMonths: [
      { value: 0, label: 'Deloc' },
      { value: 1, label: 'Cam o lună' },
      { value: 2, label: 'Două luni' },
      { value: 3, label: 'Între 3 și 5 luni' },
      { value: 6, label: '6 luni sau mai mult' },
    ],
    expensiveDebt: [
      { value: true, label: 'Da' },
      { value: false, label: 'Nu' },
    ],
    horizon: [
      { value: 'sub_1_an', label: 'În mai puțin de un an' },
      { value: '1_3_ani', label: 'În 1–3 ani' },
      { value: 'peste_3_ani', label: 'Peste 3 ani, sau nu știu încă' },
    ] satisfies { value: MoneyHorizon; label: string }[],
  },
};
