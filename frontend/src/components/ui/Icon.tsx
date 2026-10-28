type Name = 'acasa' | 'momente' | 'stiri' | 'chevron' | 'external' | 'back' | 'check' | 'close' | 'cross' | 'bulb' | 'bolt' | 'flame' | 'lock' | 'star' | 'medal' | 'grip' | 'redo';

const PATHS: Record<Name, React.ReactNode> = {
  acasa: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />,
  momente: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  stiri: (
    <>
      <path d="M5 5h11v14H6a1 1 0 0 1-1-1V5Z" />
      <path d="M16 9h3v9a1 1 0 0 1-1 1h-2" />
      <path d="M8 9h5M8 12.5h5M8 16h3" />
    </>
  ),
  chevron: <path d="m9.5 6 6 6-6 6" />,
  external: <path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />,
  back: <path d="M14.5 6 8.5 12l6 6" />,
  check: <path d="m5.5 12.5 4 4 9-9" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  cross: <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />,
  bulb: (
    <>
      <path d="M9 17.5h6M10 20.5h4" />
      <path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.5 1.2 1.3 1.2 2.1v.4h4v-.4c0-.8.5-1.6 1.2-2.1A5.5 5.5 0 0 0 12 3.5Z" />
    </>
  ),
  bolt: <path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12l1-7Z" />,
  flame: <path d="M12 20.5c3.6 0 6-2.4 6-5.8 0-3.9-3.2-6.2-4.2-10.2-2.3 1.4-3.6 3.8-3.4 6.4-1.1-.5-1.9-1.6-2.1-2.9C6.9 9.6 6 11.7 6 14.7c0 3.4 2.4 5.8 6 5.8Z" />,
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6L12 4Z" />,
  medal: (
    <>
      <circle cx="12" cy="14.5" r="5" />
      <path d="M9 10.2 6.5 3.5h4l1.5 4M15 10.2l2.5-6.7h-4L12 7.5" />
    </>
  ),
  grip: <path d="M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01" strokeWidth={3} />,
  redo: <path d="M18.5 9A7 7 0 1 0 19 14M18.5 4.5V9H14" />,
};

/** Hand-drawn 24px line icons. Decorative unless a label is given. */
export function Icon({ name, size = 24, label }: { name: Name; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name]}
    </svg>
  );
}
