import Link from 'next/link';
import type { Foundation } from '@/data/types';

/** "Întâi fundația": before any investment, a buffer and no expensive debt. Shown at every level when needed. */
export function FoundationCard({ kind, bufferMonths }: { kind: NonNullable<Foundation>; bufferMonths: number }) {
  if (kind === 'datorii_scumpe') {
    return (
      <section className="card card-accent" aria-labelledby="fundatia">
        <span className="eyebrow" style={{ color: 'var(--accent-ink)' }}>
          Întâi fundația
        </span>
        <h2 id="fundatia">Datoriile scumpe</h2>
        <p className="small">
          Un card de credit sau un credit de nevoi personale costă de obicei mai mult decât aduce orice economie. Le închidem întâi pe ele.
        </p>
        <button className="btn btn-secondary btn-sm" disabled style={{ alignSelf: 'flex-start' }}>
          Lecția vine în curând
        </button>
      </section>
    );
  }
  const months = bufferMonths < 1 ? 'mai puțin de o lună' : bufferMonths === 1 ? 'o lună' : `${bufferMonths} luni`;
  return (
    <section className="card card-accent" aria-labelledby="fundatia">
      <span className="eyebrow" style={{ color: 'var(--accent-ink)' }}>
        Întâi fundația
      </span>
      <h2 id="fundatia">Fondul de urgență</h2>
      <p className="small">
        Acum ai bani pentru {months}. Ținta: 3 luni de cheltuieli, într-un loc din care îi scoți oricând. Abia apoi are sens să investești.
      </p>
      <Link href="/moment/lib/fondul_urgenta" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
        Învață în 4 minute
      </Link>
    </section>
  );
}
