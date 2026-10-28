import { Icon } from '@/components/ui/Icon';
import type { weekOf } from '@/data/mock/game';

/** Monday to Sunday, a flame on each day with a finished lesson, today ringed. */
export function WeekStrip({ week, letters }: { week: ReturnType<typeof weekOf>; letters: string[] }) {
  return (
    <ol className="week">
      {week.map((d, i) => (
        <li key={d.day} data-active={d.active || undefined} data-today={d.today || undefined} data-future={d.future || undefined}>
          <span className="week-dot">{d.active ? <Icon name="flame" size={16} /> : null}</span>
          <span className="week-day">{letters[i]}</span>
        </li>
      ))}
    </ol>
  );
}
