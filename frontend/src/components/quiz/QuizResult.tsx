'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LessonBar } from '@/components/lesson/LessonBar';
import { LevelBadge } from '@/components/ui/LevelBadge';
import type { LibraryMoment, Profile } from '@/data/types';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { TERMS } from '@/i18n/terms';

const T = copy(
  {
    kicker: 'Gata, te-am cunoscut',
    startAt: 'Pornești de la nivelul',
    score: (reason: string, risk: string, line: string) => `${reason} · profil ${risk}: ${line}`,
    first: (min: number) => `Prima ta lecție · ${min} minute`,
    browse: 'Mai întâi vreau să mă uit prin aplicație',
    note: 'Nivelul schimbă doar ordinea în care îți arătăm lucrurile. Nu e o recomandare de investiții.',
    start: 'Începe lecția',
  },
  {
    kicker: 'Done, nice to meet you',
    startAt: "You're starting at",
    score: (reason, risk, line) => `${reason} · ${risk} profile: ${line}`,
    first: (min) => `Your first lesson · ${min} minutes`,
    browse: "I'd rather look around the app first",
    note: "Your level only changes the order we show things in. It's not investment advice.",
    start: 'Start the lesson',
  },
);

/** Where you start, said in one screen, and straight into the first lesson. */
export function QuizResult({ profile, lesson }: { profile: Profile; lesson?: Pick<LibraryMoment, 'id' | 'title' | 'hook' | 'minutes'> }) {
  const router = useRouter();
  const { lang } = useLang();
  const t = T[lang];
  const terms = TERMS[lang];
  const levelName = terms.level[profile.level];
  return (
    <main className="onboard">
      <div className="onboard-body" style={{ paddingTop: 48 }}>
        <h1 className="lesson-q rise">
          {t.startAt} <span style={{ whiteSpace: 'nowrap' }}>{lang === 'ro' ? levelName.toLowerCase() : `${levelName.toLowerCase()} level`}</span>
        </h1>
        <span className="lesson-hint rise">{t.kicker}</span>
        <div className="row-start rise">
          <LevelBadge level={profile.level} />
          <span className="muted">
            {t.score(terms.placement[profile.quizLevel], terms.risk[profile.riskProfile], terms.riskLine[profile.riskProfile].toLowerCase())}
          </span>
        </div>
        {lesson && (
          <div className="stat rise" style={{ gap: 6 }}>
            <span className="stat-label" style={{ fontSize: 14, fontWeight: 700 }}>
              {t.first(lesson.minutes)}
            </span>
            <div className="display-md" style={{ color: '#fff' }}>
              {lesson.title}
            </div>
            <span className="stat-label">{lesson.hook}</span>
          </div>
        )}
        <Link href="/acasa" className="small" style={{ alignSelf: 'center' }}>
          {t.browse}
        </Link>
        <p className="note">{t.note}</p>
      </div>
      <LessonBar label={t.start} onClick={() => router.push(lesson ? `/moment/lib/${lesson.id}` : '/acasa')} />
    </main>
  );
}
