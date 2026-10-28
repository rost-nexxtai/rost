'use client';

import Link from 'next/link';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { Icon } from './Icon';

const T = copy(
  { nav: 'Secțiuni', acasa: 'Acasă', momente: 'Momente', stiri: 'Știri' },
  { nav: 'Sections', acasa: 'Home', momente: 'Moments', stiri: 'News' },
);

const TABS = [
  { id: 'acasa', href: '/acasa' },
  { id: 'momente', href: '/momente' },
  { id: 'stiri', href: '/stiri' },
] as const;

export function TabBar({ current }: { current?: 'acasa' | 'momente' | 'stiri' }) {
  const t = T[useLang().lang];
  return (
    <nav className="tabbar" aria-label={t.nav}>
      <div className="tabbar-inner">
        {TABS.map((tab) => (
          <Link key={tab.id} href={tab.href} aria-current={current === tab.id ? 'page' : undefined}>
            <Icon name={tab.id} />
            {t[tab.id]}
          </Link>
        ))}
      </div>
    </nav>
  );
}
