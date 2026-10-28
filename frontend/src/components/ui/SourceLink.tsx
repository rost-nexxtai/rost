import { Icon } from './Icon';

export function SourceLink({ label, url, date }: { label: string; url: string; date?: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {label}
      {date && <span className="muted">· {date}</span>}
      <Icon name="external" size={14} />
    </a>
  );
}
