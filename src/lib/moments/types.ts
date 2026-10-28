import type { EventType, Situation } from '../store/types';

export type Step =
  | { type: 'predict'; question: string; answer: string; min: number; max: number; step: number; unit: string; start?: number }
  | { type: 'reveal'; view: 'payslip' | 'personal_inflation' | 'scenario' }
  | { type: 'card'; title: string; body: string; link?: { label: string; href: string } }
  | {
      type: 'action';
      action: string;
      title: string;
      body: string;
      options: number[];
      defaultOption: number | null;
    };

export interface MomentDefinition {
  id: string;
  series: string;
  title: string;
  minutes: number;
  /** Events that can open this moment. `catch_up` (user-initiated) can open any moment. */
  triggers: EventType[];
  /** Events that may open it again after it was completed. */
  repeatOn?: EventType[];
  conditions: {
    situations?: Situation[];
    requires?: ('grossMonthly' | 'spending' | 'hireDate' | 'monthlyExpenses')[];
  };
  steps: Step[];
  followUpDays: number;
}
