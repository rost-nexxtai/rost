import type { Profile } from '../types';

/** FIXTURE: synthetic demo personas. Maria matches backend/internal/reference/data/seed/demo-users.json and the MVP's Știri numbers. */
export const PERSONAS = {
  maria: {
    name: 'Maria',
    quizScore: 2,
    quizLevel: 1,
    level: 1,
    riskProfile: 'echilibrat',
    ageBand: 'sub_25',
    situation: 'employed',
    bufferMonths: 0.8,
    expensiveDebt: false,
    horizon: 'peste_3_ani',
    money: { fuelLei: 400, electricityLei: 150, savedLei: 2500, inflationPct: 8.48 },
    completedMomentIds: [],
  },
} satisfies Record<string, Profile>;
