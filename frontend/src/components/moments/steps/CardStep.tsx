export function CardStep({ title, body, onNext, link }: { title: string; body: string; onNext: () => void; link?: { label: string; href: string } }) {
  return (
    <div className="stack-lg rise">
      <div className="card card-tint" style={{ gap: 10 }}>
        <h2>{title}</h2>
        <p>{body}</p>
        {link && (
          <a href={link.href} target="_blank" rel="noreferrer" className="small">
            {link.label}
          </a>
        )}
      </div>
      <button className="btn btn-primary btn-block" onClick={onNext}>
        Mai departe
      </button>
    </div>
  );
}
