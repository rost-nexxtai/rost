type Name = 'acasa' | 'momente' | 'stiri' | 'chevron' | 'external' | 'back' | 'check' | 'close' | 'cross' | 'bulb' | 'bolt';

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
