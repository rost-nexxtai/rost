import Link from 'next/link';

const items = [
  { href: '/today', label: 'Today' },
  { href: '/options', label: 'Options' },
  { href: '/simulator', label: 'Simulator' },
  { href: '/metrics', label: 'Metrics' },
];

export function Nav({ current }: { current: string }) {
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={current === i.href ? 'page' : undefined}>
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function TopBar() {
  return (
    <header className="topbar">
      <Link href="/today" className="wordmark">
        rost<span>.</span>
      </Link>
    </header>
  );
}
