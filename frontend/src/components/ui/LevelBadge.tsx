type Level = 0 | 1 | 2;

export function LevelBadge({ level }: { level: Level }) {
  return <span className="level-badge">L{level}</span>;
}
