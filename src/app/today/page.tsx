import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CatchUpButton, FollowUp } from '@/components/ClientActions';
import { Nav, TopBar } from '@/components/Nav';
import { momentDefs } from '@/lib/reference';
import { dueFollowUps } from '@/lib/service';
import { currentUserId } from '@/lib/session';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

const ACTION_TEXT: Record<string, string> = {
  payday_savings_rule: 'Did you set up your payday savings transfer?',
  update_buffer_target: 'Did you update your emergency-buffer target?',
};

export default async function Today() {
  const uid = await currentUserId();
  const store = await getStore();
  const user = uid ? await store.getUser(uid) : undefined;
  if (!user) redirect('/');

  const runs = await store.listRuns(user.id);
  const open = runs.filter((r) => r.state === 'pending' || r.state === 'started');
  const done = new Set(runs.filter((r) => r.state === 'completed').map((r) => r.momentId));
  const defs = momentDefs();
  const title = (id: string) => defs.find((d) => d.id === id)?.title ?? id;
  const catchUp = defs.filter((d) => !done.has(d.id) && !open.some((r) => r.momentId === d.id) && d.triggers[0] !== 'shock_scenario');
  const due = await dueFollowUps(store, user.id);

  return (
    <main className="shell">
      <TopBar />
      <section className="stack" style={{ gap: 4 }}>
        <h1>Hi {user.name ?? 'there'}</h1>
        <p className="muted">{open.length ? 'Something new is ready for you.' : 'Nothing new right now. We’ll tell you when it matters.'}</p>
      </section>

      {due.map((a) => (
        <FollowUp key={a.id} actionId={a.id} text={ACTION_TEXT[a.type] ?? 'Did you do it?'} />
      ))}

      {open.map((r) => {
        const def = defs.find((d) => d.id === r.momentId);
        return (
          <section key={r.id} className="card card-dark">
            <span className="eyebrow">
              New moment · {def?.minutes ?? 3} min · {def?.series}
            </span>
            <h2 style={{ fontSize: 26, lineHeight: '30px' }}>{title(r.momentId)}</h2>
            <Link href={`/moment/${r.id}`} className="btn btn-light" style={{ alignSelf: 'flex-start' }}>
              Start
            </Link>
          </section>
        );
      })}

      <section className="card">
        <div className="row">
          <h2>Your moments</h2>
          <span className="small muted">
            {done.size} of {defs.length} done
          </span>
        </div>
        {defs.map((d) => (
          <div key={d.id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <span>
              <strong>{d.title}</strong>
              <br />
              <span className="small muted">{d.series}</span>
            </span>
            {done.has(d.id) ? (
              <span className="badge">Done</span>
            ) : catchUp.some((c) => c.id === d.id) ? (
              <CatchUpButton momentId={d.id} label="Catch up" />
            ) : null}
          </div>
        ))}
      </section>

      <Link href="/options" className="btn btn-ghost">
        Compare where to keep your savings
      </Link>
      <Nav current="/today" />
    </main>
  );
}
