'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
    payslip: { title: 'Salariul tău, pe înțeles', hook: (gross: string) => `Unde merg cei ${gross} brut, leu cu leu.` },
  },
  {
    kicker: 'Done, nice to meet you',
    startAt: "You're starting at",
    score: (reason, risk, line) => `${reason} · ${risk} profile: ${line}`,
    first: (min) => `Your first lesson · ${min} minutes`,
    browse: "I'd rather look around the app first",
    note: "Your level only changes the order we show things in. It's not investment advice.",
    start: 'Start the lesson',
    payslip: { title: 'Your payslip, explained', hook: (gross) => `Where your ${gross} gross goes, line by line.` },
  },
);

/**
 * Where you start, said in one screen, and straight into the first lesson.
 * With a salary (employed), the first lesson is the payslip: it's about your own money, so it comes before the library.
 */
export function QuizResult({
  profile,
  lesson,
  grossMonthly,
}: {
  profile: Profile;
  lesson?: Pick<LibraryMoment, 'id' | 'title' | 'hook' | 'minutes'>;
  grossMonthly?: number;
}) {
  const router = useRouter();
  const { lang, f } = useLang();
  const t = T[lang];
  const terms = TERMS[lang];
  const levelName = terms.level[profile.level];
  const [busy, setBusy] = useState(false);
  const first = grossMonthly ? { title: t.payslip.title, hook: t.payslip.hook(f.lei(grossMonthly)), minutes: 3 } : lesson;
  const fallback = lesson ? `/moment/lib/${lesson.id}` : '/acasa';

  async function start() {
    if (!grossMonthly) return router.push(fallback);
    setBusy(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'catch_up', payload: { momentId: 'payslip_explained', grossMonthly } }),
      });
      const run = res.ok ? (await res.json()).runs?.[0] : undefined;
      router.push(run ? `/moment/${run.id}` : fallback);
    } catch {
      router.push(fallback); // API down: the library lesson still works
    }
  }
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
        {first && (
          <div className="stat rise" style={{ gap: 6 }}>
            <span className="stat-label" style={{ fontSize: 14, fontWeight: 700 }}>
              {t.first(first.minutes)}
            </span>
            <div className="display-md" style={{ color: '#fff' }}>
              {first.title}
            </div>
            <span className="stat-label">{first.hook}</span>
          </div>
        )}
        <Link href="/acasa" className="small" style={{ alignSelf: 'center' }}>
          {t.browse}
        </Link>
        <p className="note">{t.note}</p>
      </div>
      <LessonBar label={t.start} disabled={busy} onClick={() => void start()} />
    </main>
  );
}
