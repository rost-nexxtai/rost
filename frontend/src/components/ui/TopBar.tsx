import Link from 'next/link';
import { LevelBadge } from './LevelBadge';

import type { Level, RiskProfile } from '@/data/types';

/** Wordmark, plus the level chip that opens Profil once the user has a profile. */
export function TopBar({ profile }: { profile?: { level: Level; riskProfile: RiskProfile } }) {
  return (
    <header className="topbar">
      <Link href={profile ? '/acasa' : '/'} className="wordmark">
        rost<span>.</span>
      </Link>
      {profile && (
        <Link href="/profil" className="level-chip" aria-label={`Profilul tău: nivel L${profile.level}, ${profile.riskProfile}`}>
          <LevelBadge level={profile.level} />
          {profile.riskProfile}
        </Link>
      )}
    </header>
  );
}
