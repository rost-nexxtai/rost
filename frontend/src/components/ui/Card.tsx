export function Card({
  tone = 'plain',
  className = '',
  children,
  ...rest
}: { tone?: 'plain' | 'dark' | 'tint' | 'accent'; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  const toneClass = tone === 'plain' ? '' : ` card-${tone}`;
  return (
    <section className={`card${toneClass} ${className}`.trim()} {...rest}>
      {children}
    </section>
  );
}
