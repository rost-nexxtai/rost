import type { LessonAnswer } from '@/contract';

/** What a graded screen hands back besides right or wrong: the raw answer, for the server to score. */
export type StepAnswer = Omit<LessonAnswer, 'step'>;
