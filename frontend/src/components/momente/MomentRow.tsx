import Link from 'next/link';
import { CatchUpButton } from '@/components/ClientActions';
import { Icon } from '@/components/ui/Icon';
import type { MomentSummary } from '@/data/types';

export function MomentRow({ m }: { m: MomentSummary }) {
  const body = (
    <>
      <div className="stack" style={{ gap: 4, minWidth: 0 }}>
        <strong>{m.title}</strong>
        <span className="small muted">
          {m.hook ?? m.series} · {m.minutes} min
        </span>
      </div>
      {m.status === 'done' ? (
        <span className="tag tag-done">
          <Icon name="check" size={14} /> Gata
        </span>
      ) : m.status === 'soon' ? (
        <span className="tag tag-example">În curând</span>
      ) : m.catchUpMomentId ? (
        <CatchUpButton momentId={m.catchUpMomentId} label="Începe" />
      ) : (
        <span style={{ color: 'var(--muted)' }}>
          <Icon name="chevron" size={20} />
        </span>
      )}
    </>
  );

  if (m.href && m.status !== 'done') {
    return (
      <Link href={m.href} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
        {body}
      </Link>
    );
  }
  return <div className="list-row">{body}</div>;
}
