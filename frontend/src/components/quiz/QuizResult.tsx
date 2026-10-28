import Link from 'next/link';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { foundationFor } from '@/data/mock/scoring';
import type { Level, Profile, RiskProfile } from '@/data/types';

export const LEVEL_NAME: Record<Level, string> = { 0: 'Începător', 1: 'Mediu', 2: 'Avansat' };
export const RISK_LINE: Record<RiskProfile, string> = {
  prudent: 'Pui siguranța pe primul loc',
  echilibrat: 'Un pic de risc, pentru mai mult randament',
  dinamic: 'Accepți scăderi pe termen scurt',
};

export function QuizResult({ profile, note }: { profile: Profile; note?: string }) {
  return (
    <div className="stack-lg rise">
      <span className="eyebrow">Rezultatul tău</span>
      <section className="card card-dark" style={{ gap: 16 }}>
        <div className="row-start">
          <LevelBadge level={profile.level} />
          <span className="muted small">{profile.quizScore} din 6 răspunsuri corecte</span>
        </div>
        <div className="display-md">Nivel {LEVEL_NAME[profile.level].toLowerCase()}</div>
        <hr className="divider" style={{ background: '#2b2f37' }} />
        <div className="stack" style={{ gap: 2 }}>
          <span className="eyebrow">Profil de risc</span>
          <strong style={{ fontSize: 18, textTransform: 'capitalize' }}>{profile.riskProfile}</strong>
          <span className="muted small">{RISK_LINE[profile.riskProfile]}</span>
        </div>
      </section>
      {foundationFor(profile) && (
        <div className="card card-accent">
          <p className="small">
            <strong>Întâi fundația:</strong> îți arătăm de unde să începi, înainte de orice investiție.
          </p>
        </div>
      )}
      {note && <p className="note">{note}</p>}
      <p className="note">
        Nivelul schimbă doar ordinea în care îți arătăm lucrurile. Vezi oricând toate opțiunile. Nu e o recomandare de investiții.
      </p>
      <Link href="/acasa" className="btn btn-primary btn-block">
        Mergi la Acasă
      </Link>
    </div>
  );
}
