import Link from 'next/link';

export function Chip({
  pressed,
  href,
  onClick,
  children,
}: {
  pressed?: boolean;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className="chip" aria-pressed={pressed} scroll={false}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}
