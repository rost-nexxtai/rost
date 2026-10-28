import { useState } from 'react';
import { MOMENTS, type Moment } from './data';
import type { Profile } from './profile';

export function Moments({
  profile,
  openId,
  onOpen,
  onComplete,
}: {
  profile: Profile;
  openId?: string;
  onOpen: (id: string | undefined) => void;
  onComplete: (id: string) => void;
}) {
  const current = MOMENTS.find((m) => m.id === openId);
  if (current) {
    return <MomentView key={current.id} moment={current} onClose={() => onOpen(undefined)} onComplete={() => onComplete(current.id)} />;
  }

  const recommended = MOMENTS.filter((m) => m.level === profile.level);
  const rest = MOMENTS.filter((m) => m.level !== profile.level);
  const doneHere = recommended.filter((m) => profile.doneMoments.includes(m.id)).length;

  return (
    <>
      <h1>Momente</h1>
      <p className="muted">Lecții scurte, de maxim 5 minute. Termină-le pe cele recomandate ca să avansezi.</p>

      <section className="stack">
        <div className="row">
          <h2>Recomandate pentru tine</h2>
          <span className="small muted">
            {doneHere}/{recommended.length}
          </span>
        </div>
        {recommended.map((m) => (
          <MomentRow key={m.id} moment={m} done={profile.doneMoments.includes(m.id)} onOpen={() => onOpen(m.id)} />
        ))}
      </section>

      <section className="stack">
        <h2>Toate momentele</h2>
        {rest.map((m) => (
          <MomentRow key={m.id} moment={m} done={profile.doneMoments.includes(m.id)} onOpen={() => onOpen(m.id)} />
        ))}
      </section>
    </>
  );
}

function MomentRow({ moment, done, onOpen }: { moment: Moment; done: boolean; onOpen: () => void }) {
  return (
    <button className="card row reset" onClick={onOpen}>
      <span>
        <strong>{moment.title}</strong>
        <br />
        <span className="small muted">
          L{moment.level} · {moment.minutes} min
        </span>
      </span>
      {done ? <span className="badge">Gata</span> : <span className="small muted">Start →</span>}
    </button>
  );
}

function MomentView({ moment, onClose, onComplete }: { moment: Moment; onClose: () => void; onComplete: () => void }) {
  const [picked, setPicked] = useState<number>();
  const answered = picked !== undefined;

  return (
    <>
      <div className="row">
        <span className="small muted">
          Moment · L{moment.level} · {moment.minutes} min
        </span>
        <button className="link" onClick={onClose}>
          Închide
        </button>
      </div>
      <span className="eyebrow">Ghicește întâi</span>
      <h1>{moment.question}</h1>
      <div className="stack">
        {moment.options.map((o, i) => {
          const state = !answered ? '' : i === moment.correct ? 'right' : i === picked ? 'wrong' : '';
          return (
            <button key={i} className={`chip ${state}`} disabled={answered} onClick={() => setPicked(i)}>
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <>
          <div className="card card-tint">
            <strong>{picked === moment.correct ? 'Corect!' : 'Nu chiar.'}</strong>
            <p>{moment.explanation}</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              onComplete();
              onClose();
            }}
          >
            Am înțeles
          </button>
        </>
      )}
    </>
  );
}
