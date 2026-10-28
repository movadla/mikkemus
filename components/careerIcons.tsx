type IconProps = { className?: string };

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

/** The home: a roof over a door. */
export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m3 11 9-7 9 7" />
      <path d="M5.5 10v10h13V10" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

/** The arena, as a lamp over a board: what is bought for the room. */
export function ArenaIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 3h6l2 6H7z" />
      <path d="M12 9v2" />
      <circle cx="12" cy="17" r="4" />
      <circle cx="12" cy="17" r="1" />
    </svg>
  );
}

/** A padlock, for what is not open yet. */
export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** A star, for the ranking points. */
export function StarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
    </svg>
  );
}
