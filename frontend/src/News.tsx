import { NEWS } from './data';
import type { Profile } from './profile';

export function News({ profile }: { profile: Profile }) {
  const items = NEWS.filter((n) => n.levels.includes(profile.level));
  return (
    <>
      <h1>Știri</h1>
      <p className="muted">Ce se întâmplă în lume și cum te afectează pe tine.</p>
      {items.map((n) => (
        <article key={n.id} className="card">
          <h2>{n.title}</h2>
          <p className="small muted">{n.summary}</p>
          <div className="impact">
            <span className="eyebrow">Ce înseamnă pentru tine</span>
            <p className="small">{n.impact}</p>
          </div>
        </article>
      ))}
      <p className="note">Știri de exemplu pentru demo.</p>
    </>
  );
}
