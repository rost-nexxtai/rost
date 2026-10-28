'use client';

import Link from 'next/link';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { TERMS } from '@/i18n/terms';
import type { Level, RiskProfile } from '@/data/types';
import { LangSwitch } from './LangSwitch';
import { LevelBadge } from './LevelBadge';

const T = copy(
  { profile: (level: Level, risk: string) => `Profilul tău: nivel L${level}, ${risk}` },
  { profile: (level, risk) => `Your profile: level L${level}, ${risk}` },
);

/** Wordmark, the language switch, and the level chip that opens Profil once the user has a profile. */
export function TopBar({ profile }: { profile?: { level: Level; riskProfile: RiskProfile } }) {
  const { lang } = useLang();
  const risk = profile ? TERMS[lang].risk[profile.riskProfile] : '';
  return (
    <header className="topbar">
      <Link href={profile ? '/acasa' : '/'} className="wordmark">
        rost<span>.</span>
      </Link>
      <div className="topbar-right">
        <LangSwitch />
        {profile && (
          <Link href="/profil" className="level-chip" aria-label={T[lang].profile(profile.level, risk)}>
            <LevelBadge level={profile.level} />
            {risk}
          </Link>
        )}
      </div>
    </header>
  );
}
