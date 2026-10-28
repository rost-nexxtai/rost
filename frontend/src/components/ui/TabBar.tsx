import Link from 'next/link';
import { Icon } from './Icon';

const TABS = [
  { id: 'acasa', href: '/acasa', label: 'Acasă' },
  { id: 'momente', href: '/momente', label: 'Momente' },
  { id: 'stiri', href: '/stiri', label: 'Știri' },
] as const;

export function TabBar({ current }: { current?: 'acasa' | 'momente' | 'stiri' }) {
  return (
    <nav className="tabbar" aria-label="Secțiuni">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <Link key={t.id} href={t.href} aria-current={current === t.id ? 'page' : undefined}>
            <Icon name={t.id} />
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
