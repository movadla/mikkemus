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

/** The icons of the six things for the room. */
export function SlotIcon({ id, className }: { id: "wall" | "floor" | "board" | "light" | "decor" | "crowd"; className?: string }) {
  return (
    <svg {...base} className={className}>
      {id === "wall" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M3 10h18M3 15h18M9 4v6M15 10v5M9 15v5" />
        </>
      )}
      {id === "floor" && (
        <>
          <path d="M3 20 8 8h8l5 12z" />
          <path d="M6 14h12" />
        </>
      )}
      {id === "board" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" />
        </>
      )}
      {id === "light" && (
        <>
          <path d="M9 3h6l2 7H7z" />
          <path d="M12 10v3M9 20h6M12 13v7" />
        </>
      )}
      {id === "decor" && (
        <>
          <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
          <path d="M12 14v4M8 20h8" />
        </>
      )}
      {id === "crowd" && (
        <>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 2 6 6" />
        </>
      )}
    </svg>
  );
}

/** A snowflake: an opponent who is cold today. */
export function SnowIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
      <path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2" />
    </svg>
  );
}

/** A flag on a pole: the road to the world championship. */
export function RoadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 21V4" />
      <path d="M6 5h11l-2.5 3.5L17 12H6" />
    </svg>
  );
}

/** A letter: the inbox. */
export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

/** A newspaper: the news. */
export function NewsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 4.5h11v15H6.5A1.5 1.5 0 0 1 5 18z" />
      <path d="M16 8.5h3v9a2 2 0 0 1-2 2" />
      <path d="M8 8h5M8 11.5h5M8 15h3" />
    </svg>
  );
}
