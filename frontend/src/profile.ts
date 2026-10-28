export type Level = 0 | 1 | 2;
export type Risk = 'conservator' | 'moderat' | 'dinamic';

export interface Profile {
  age: number;
  level: Level;
  risk: Risk;
  doneMoments: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

/** Onboarding knowledge check. Correct answers set the starting level. */
export const QUIZ: QuizQuestion[] = [
  {
    question: 'Inflația este 6% pe an, iar depozitul tău aduce 4%. Ce se întâmplă cu banii tăi?',
    options: ['Cresc în valoare reală', 'Pierd din puterea de cumpărare', 'Rămân la fel'],
    correct: 1,
  },
  {
    question: 'Ce este un ETF?',
    options: [
      'Un cont de economii cu dobândă fixă',
      'Un fond care deține multe acțiuni sau obligațiuni și se tranzacționează la bursă',
      'Un tip de credit pentru tineri',
    ],
    correct: 1,
  },
  {
    question: 'Care variantă e cea mai riscantă pe termen scurt?',
    options: ['Titluri de stat', 'Depozit bancar', 'Acțiunile unei singure companii'],
    correct: 2,
  },
];

export const LEVEL_LABEL: Record<Level, string> = {
  0: 'L0 · Început',
  1: 'L1 · Mediu',
  2: 'L2 · Avansat',
};

export function levelFromScore(correct: number): Level {
  if (correct >= 3) return 2;
  if (correct === 2) return 1;
  return 0;
}

/** Risk profile: mostly the education level, nudged by age (younger = longer horizon). */
export function riskFor(age: number, level: Level): Risk {
  const points = level + (age <= 25 ? 1 : age >= 40 ? -1 : 0);
  if (points <= 0) return 'conservator';
  if (points >= 3) return 'dinamic';
  return 'moderat';
}

const KEY = 'rost.profile';

export function loadProfile(): Profile | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : undefined;
  } catch {
    return undefined;
  }
}

export function saveProfile(p: Profile | undefined): void {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode): the app still works for this session.
  }
}
