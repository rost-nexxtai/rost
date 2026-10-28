import type { Level } from '@/data/types';

export function LevelBadge({ level }: { level: Level }) {
  return <span className="level-badge">L{level}</span>;
}
