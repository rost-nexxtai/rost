import type { Lang } from '@/i18n/lang';
import type { AgeBand, Situation } from '../types';

export interface KnowledgeQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  /** The knowledge tier it tests: 0 = the basics (passing skips the L0 lessons), 1 = L1 concepts. */
  tier: 0 | 1;
}

/**
 * FIXTURE until onboarding uses POST /api/quiz; the questions, right answers and tiers must match
 * backend/internal/reference/data/seed/quiz.json (a test checks). Four taps about you, then two
 * questions per tier: the tier-1 pair is only asked once both basics are right (see
 * docs/level-assessment.md). "Nu știu" is added by the UI to every question.
 */
export const QUIZ = {
  knowledge: [
    {
      id: 'inflatie',
      question: 'Ții 1.000 lei sub saltea un an, cu inflație de 6%. Cu ei cumperi…',
      options: ['Mai mult', 'La fel', 'Mai puțin'],
      correct: 2,
      tier: 0,
    },
    {
      id: 'dobanda_compusa',
      question: '1.000 lei la 10% pe an, 2 ani, fără să scoți nimic. Ai…',
      options: ['Exact 1.200 lei', 'Peste 1.200 lei', 'Sub 1.200 lei'],
      correct: 1,
      tier: 0,
    },
    {
      id: 'actiune_vs_etf',
      question: 'Ce e mai riscant?',
      options: ['Acțiunile unei singure companii', 'Un ETF cu sute de companii', 'La fel de riscante'],
      correct: 0,
      tier: 1,
    },
    {
      id: 'obligatiuni_dobanzi',
      question: 'Dobânzile cresc. Ce se întâmplă de obicei cu prețul obligațiunilor deja emise?',
      options: ['Crește', 'Scade', 'Rămâne la fel'],
      correct: 1,
      tier: 1,
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
    { id: 'inflatie', question: 'You keep 1,000 lei under the mattress for a year, with 6% inflation. With it you can buy…', options: ['More', 'The same', 'Less'], correct: 2, tier: 0 },
    { id: 'dobanda_compusa', question: '1,000 lei at 10% a year, for 2 years, taking nothing out. You have…', options: ['Exactly 1,200 lei', 'Over 1,200 lei', 'Under 1,200 lei'], correct: 1, tier: 0 },
    { id: 'actiune_vs_etf', question: 'Which is riskier?', options: ["One company's shares", 'An ETF with hundreds of companies', 'Equally risky'], correct: 0, tier: 1 },
    { id: 'obligatiuni_dobanzi', question: 'Interest rates go up. What usually happens to the price of bonds already issued?', options: ['It goes up', 'It goes down', 'It stays the same'], correct: 1, tier: 1 },
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
