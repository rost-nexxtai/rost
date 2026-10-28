import { copy, type Lang } from '@/i18n/lang';
import type { WeekDay } from '@/data/mock/rhythm';

const T = copy(
  {
    days: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    label: (n: number) => (n === 0 ? 'Nicio lecție săptămâna asta' : n === 1 ? 'O zi cu lecții săptămâna asta' : `${n} zile cu lecții săptămâna asta`),
  },
  {
    days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    label: (n) => (n === 0 ? 'No lessons this week yet' : n === 1 ? 'One day with a lesson this week' : `${n} days with a lesson this week`),
  },
);

/** This week, Monday to Sunday: a filled dot for each day with a finished lesson, today outlined. */
export function WeekDots({ week, lang }: { week: WeekDay[]; lang: Lang }) {
  const t = T[lang];
  const active = week.filter((d) => d.active).length;
  return (
    <div className="week">
      <ol className="week-days" aria-label={t.label(active)}>
        {week.map((d, i) => (
          <li key={d.day} data-active={d.active || undefined} data-today={d.today || undefined} data-future={d.future || undefined}>
            <span className="week-dot" />
            <span className="week-day">{t.days[i]}</span>
          </li>
        ))}
      </ol>
      <span className="small muted">{t.label(active)}</span>
    </div>
  );
}
