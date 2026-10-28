'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LessonBar } from '@/components/lesson/LessonBar';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { firstLesson } from '@/data/mock/momente';
import type { Level, Profile, RiskProfile } from '@/data/types';

export const LEVEL_NAME: Record<Level, string> = { 0: 'Începător', 1: 'Mediu', 2: 'Avansat' };
export const RISK_LINE: Record<RiskProfile, string> = {
  prudent: 'Pui siguranța pe primul loc',
  echilibrat: 'Un pic de risc, pentru mai mult randament',
  dinamic: 'Accepți scăderi pe termen scurt',
};

/** Where you start, said in one screen, and straight into the first lesson. */
export function QuizResult({ profile, note }: { profile: Profile; note?: string }) {
  const router = useRouter();
  const lesson = firstLesson(profile);
  return (
    <main className="onboard">
      <div className="onboard-body" style={{ paddingTop: 48 }}>
        <span className="lesson-kicker rise">Gata, te-am cunoscut</span>
        <h1 className="lesson-q rise">
          Pornești de la nivelul <span style={{ whiteSpace: 'nowrap' }}>{LEVEL_NAME[profile.level].toLowerCase()}</span>
        </h1>
        <div className="row-start rise">
          <LevelBadge level={profile.level} />
          <span className="muted">
            {profile.quizScore} din 3 corecte · profil {profile.riskProfile}: {RISK_LINE[profile.riskProfile].toLowerCase()}
          </span>
        </div>
        {lesson && (
          <div className="stat rise" style={{ gap: 6 }}>
            <span className="stat-label" style={{ fontSize: 14, fontWeight: 700 }}>
              Prima ta lecție · {lesson.minutes} minute
            </span>
            <div className="display-md" style={{ color: '#fff' }}>
              {lesson.title}
            </div>
            <span className="stat-label">{lesson.hook}</span>
          </div>
        )}
        <Link href="/acasa" className="small" style={{ alignSelf: 'center' }}>
          Mai întâi vreau să mă uit prin aplicație
        </Link>
        {note && <p className="note">{note}</p>}
        <p className="note">Nivelul schimbă doar ordinea în care îți arătăm lucrurile. Nu e o recomandare de investiții.</p>
      </div>
      <LessonBar label="Începe lecția" onClick={() => router.push(lesson ? `/moment/lib/${lesson.id}` : '/acasa')} />
    </main>
  );
}
