import { copy } from '@/i18n/lang';
import type { BadgeId } from '@/data/types';

/** Words for the game layer (XP, streak, badges), shared by the lesson end and Momente. */
export const GAME = copy(
  {
    weekdays: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    days: (n: number) => (n === 1 ? '1 zi la rând' : `${n} zile la rând`),
    streak: 'Seria',
    xp: 'XP',
    badges: 'Insigne',
    newBadge: 'Insignă nouă',
    badge: {
      first: { name: 'Primul pas', what: 'Prima lecție terminată.' },
      perfect: { name: 'Fără greșeală', what: 'O lecție cu toate răspunsurile corecte din prima.' },
      combo: { name: 'Pe val', what: '5 răspunsuri corecte la rând.' },
      streak3: { name: 'Trei zile', what: 'O lecție pe zi, 3 zile la rând.' },
      streak7: { name: 'O săptămână', what: 'O lecție pe zi, 7 zile la rând.' },
      levelUp: { name: 'Nivel nou', what: 'Ai urcat un nivel terminând lecțiile de bază.' },
      xp500: { name: '500 XP', what: 'Ai strâns 500 XP.' },
    } as Record<BadgeId, { name: string; what: string }>,
  },
  {
    weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    days: (n) => (n === 1 ? '1-day streak' : `${n}-day streak`),
    streak: 'Streak',
    xp: 'XP',
    badges: 'Badges',
    newBadge: 'New badge',
    badge: {
      first: { name: 'First step', what: 'Your first lesson done.' },
      perfect: { name: 'Flawless', what: 'A lesson with every answer right first time.' },
      combo: { name: 'On a roll', what: '5 right answers in a row.' },
      streak3: { name: 'Three days', what: 'A lesson a day, 3 days in a row.' },
      streak7: { name: 'A full week', what: 'A lesson a day, 7 days in a row.' },
      levelUp: { name: 'Level up', what: 'You moved up a level by finishing the core lessons.' },
      xp500: { name: '500 XP', what: 'You collected 500 XP.' },
    },
  },
);
