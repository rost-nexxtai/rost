'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Marks the lesson done (once), then says what that did for the level and links to the asset. */
export function FinishStep({ cta, onFinish }: { cta: { label: string; href: string }; onFinish: () => Promise<string> }) {
  const [line, setLine] = useState<string>();
  useEffect(() => {
    onFinish().then(setLine).catch(() => setLine(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stack-lg rise">
      <span className="eyebrow">Gata</span>
      <h1>Ai terminat lecția.</h1>
      <p className="muted" aria-live="polite">
        {line ?? 'Salvăm progresul…'}
      </p>
      <Link href={cta.href} className="btn btn-primary btn-block">
        {cta.label}
      </Link>
      <Link href="/momente" className="btn btn-ghost btn-block">
        Înapoi la Momente
      </Link>
    </div>
  );
}
