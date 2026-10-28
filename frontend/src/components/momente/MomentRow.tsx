'use client';

import Link from 'next/link';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { CatchUpButton, CatchUpWithSalary } from '@/components/ClientActions';
import { Icon } from '@/components/ui/Icon';
import type { MomentSummary } from '@/data/types';

const T = copy(
  { done: 'Gata', soon: 'În curând', started: (step: number, of: number) => `În curs · ${step}/${of}`, startedAria: (step: number, of: number) => `În curs, pasul ${step} din ${of}` },
  { done: 'Done', soon: 'Soon', started: (step, of) => `In progress · ${step}/${of}`, startedAria: (step, of) => `In progress, step ${step} of ${of}` },
);

export function MomentRow({ m }: { m: MomentSummary }) {
  const t = T[useLang().lang];
  const text = (
    <div className="stack" style={{ gap: 4, minWidth: 0 }}>
      <strong>{m.title}</strong>
      <span className="small muted">
        {m.hook ?? m.series} · {m.minutes} min
      </span>
    </div>
  );
  if (m.catchUpMomentId && m.catchUpNeedsSalary) return <CatchUpWithSalary momentId={m.catchUpMomentId}>{text}</CatchUpWithSalary>;
  const body = (
    <>
      {text}
      {m.status === 'started' && m.progress ? (
        <span className="tag tag-progress" aria-label={t.startedAria(m.progress.step, m.progress.of)}>
          {t.started(m.progress.step, m.progress.of)}
        </span>
      ) : m.status === 'done' ? (
        <span className="tag tag-done">
          <Icon name="check" size={14} /> {t.done}
        </span>
      ) : m.status === 'soon' ? (
        <span className="tag tag-example">{t.soon}</span>
      ) : m.catchUpMomentId ? (
        <CatchUpButton momentId={m.catchUpMomentId} />
      ) : (
        <span style={{ color: 'var(--muted)' }}>
          <Icon name="chevron" size={20} />
        </span>
      )}
    </>
  );

  // done lessons stay open to replay
  if (m.href) {
    return (
      <Link href={m.href} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
        {body}
      </Link>
    );
  }
  return <div className="list-row">{body}</div>;
}
