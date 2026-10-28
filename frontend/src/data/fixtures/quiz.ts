import type { Lang } from '@/i18n/lang';
import type { AgeBand, Level, Situation } from '../types';

export interface KnowledgeQuestion {
  id: string;
  /** The level this question checks; placement needs every lower one right and one of its own. */
  level: Level;
  question: string;
  options: string[];
  correct: number;
}

/**
 * FIXTURE until the frontend uses POST /api/quiz. Ten taps in all: four about you, six quick
 * questions, two per level, the same as backend/internal/reference/data/seed/quiz.json. You place
 * at a level only with every lower question right and one of its own (placement in mock/scoring).
 * "Nu știu" is added by the UI to every question.
 */
export const QUIZ = {
  knowledge: [
    {
      id: 'inflatie',
      level: 0,
      question: 'Ții 1.000 lei sub saltea un an, cu inflație de 6%. Cu ei cumperi…',
      options: ['Mai mult', 'La fel', 'Mai puțin'],
      correct: 2,
    },
    {
      id: 'dobanda_compusa',
      level: 0,
      question: '1.000 lei la 10% pe an, 2 ani, fără să scoți nimic. Ai…',
      options: ['Exact 1.200 lei', 'Peste 1.200 lei', 'Sub 1.200 lei'],
      correct: 1,
    },
    {
      id: 'actiune_vs_etf',
      level: 1,
      question: 'Ce e mai riscant?',
      options: ['Acțiunile unei singure companii', 'Un ETF cu sute de companii', 'La fel de riscante'],
      correct: 0,
    },
    {
      id: 'titluri_impozit',
      level: 1,
      question: 'Primești 700 lei dobândă la un titlu de stat Fidelis. Cât impozit plătești pe ea?',
      options: ['Nimic', '70 lei (10%)', '112 lei (16%)'],
      correct: 0,
    },
    {
      id: 'obligatiuni_dobanzi',
      level: 2,
      question: 'Dobânzile cresc. Ce se întâmplă de obicei cu prețul obligațiunilor deja emise?',
      options: ['Crește', 'Scade', 'Rămâne la fel'],
      correct: 1,
    },
    {
      id: 'impozit_broker',
      level: 2,
      question: 'Vinzi cu câștig un ETF ținut 2 ani, printr-un broker din România care reține impozitul. Cât impozit plătești pe câștig?',
      options: ['3%', '10%', '16%'],
      correct: 0,
    },
  ] satisfies KnowledgeQuestion[],

  profile: {
    ageBand: [
      { value: 'sub_25', label: 'Sub 25' },
      { value: '25_29', label: '25–29' },
      { value: '30_plus', label: '30+' },
    ] satisfies { value: AgeBand; label: string }[],
    situation: [
      { value: 'student', label: 'Studiez' },
      { value: 'graduate', label: 'Abia am terminat școala' },
      { value: 'employed', label: 'Am un job' },
      { value: 'freelance', label: 'Lucrez pe cont propriu' },
      { value: 'between_jobs', label: 'Caut job' },
    ] satisfies { value: Situation; label: string }[],
    bufferMonths: [
      { value: 0, label: 'Nimic pus deoparte' },
      { value: 1, label: 'Cam o lună' },
      { value: 2, label: 'Două luni' },
      { value: 3, label: 'Trei luni sau mai mult' },
    ],
    expensiveDebt: [
      { value: true, label: 'Da' },
      { value: false, label: 'Nu' },
    ] satisfies { value: boolean; label: string }[],
  },
};

/** The same quiz in English: same questions, same order, same right answers. */
export const QUIZ_EN: typeof QUIZ = {
  knowledge: [
    { id: 'inflatie', level: 0, question: 'You keep 1,000 lei under the mattress for a year, with 6% inflation. With it you can buy…', options: ['More', 'The same', 'Less'], correct: 2 },
    { id: 'dobanda_compusa', level: 0, question: '1,000 lei at 10% a year, for 2 years, taking nothing out. You have…', options: ['Exactly 1,200 lei', 'Over 1,200 lei', 'Under 1,200 lei'], correct: 1 },
    { id: 'actiune_vs_etf', level: 1, question: 'Which is riskier?', options: ["One company's shares", 'An ETF with hundreds of companies', 'Equally risky'], correct: 0 },
    { id: 'titluri_impozit', level: 1, question: 'You get 700 lei of interest on a Fidelis state bond. How much tax do you pay on it?', options: ['Nothing', '70 lei (10%)', '112 lei (16%)'], correct: 0 },
    { id: 'obligatiuni_dobanzi', level: 2, question: 'Interest rates go up. What usually happens to the price of bonds already issued?', options: ['It goes up', 'It goes down', 'It stays the same'], correct: 1 },
    { id: 'impozit_broker', level: 2, question: 'You sell an ETF you held for 2 years at a gain, through a Romanian broker that withholds the tax. How much tax do you pay on the gain?', options: ['3%', '10%', '16%'], correct: 0 },
  ],
  profile: {
    ageBand: [
      { value: 'sub_25', label: 'Under 25' },
      { value: '25_29', label: '25–29' },
      { value: '30_plus', label: '30+' },
    ],
    situation: [
      { value: 'student', label: "I'm studying" },
      { value: 'graduate', label: 'I just finished school' },
      { value: 'employed', label: 'I have a job' },
      { value: 'freelance', label: "I'm self-employed" },
      { value: 'between_jobs', label: "I'm looking for a job" },
    ],
    bufferMonths: [
      { value: 0, label: 'Nothing put aside' },
      { value: 1, label: 'About a month' },
      { value: 2, label: 'Two months' },
      { value: 3, label: 'Three months or more' },
    ],
    expensiveDebt: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],
  },
};

export const quizFor = (lang: Lang) => (lang === 'en' ? QUIZ_EN : QUIZ);
