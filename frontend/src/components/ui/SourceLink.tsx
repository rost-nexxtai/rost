import { Icon } from './Icon';

/** A named, dated source that flows like text and opens in a new tab. */
export function SourceLink({ label, url, date }: { label: string; url: string; date?: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="small" style={{ display: 'inline' }}>
      {label}
      {date && <span className="muted"> · {date}</span>}{' '}
      <span style={{ display: 'inline-block', verticalAlign: '-2px' }}>
        <Icon name="external" size={14} />
      </span>
    </a>
  );
}
