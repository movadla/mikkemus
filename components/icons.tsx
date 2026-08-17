type IconProps = { className?: string };

export function CameraIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M22 18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.6-2.4A2 2 0 0 1 10.3 3.6h3.4a2 2 0 0 1 1.7 1L17 7h3a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5v3.5" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="3.5 6.5 6 6.5 20.5 6.5" />
      <path d="M18.5 6.5 17.6 20a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5.5 6.5" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9.5 6.5V4.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2v2.3" />
    </svg>
  );
}

/** A bullseye — the Singelspill mode button. A dart mid-flight reads as an ambiguous
 *  diagonal slash at icon size, so this reuses the same concentric-ring language as the
 *  app's own favicon/PWA icon (lib/dartIcon.tsx) instead. */
export function DartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A trophy — the Turnering mode button. */
export function TrophyIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 5H4a3 3 0 0 0 3 5" />
      <path d="M17 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13v3" />
      <path d="M9 20h6" />
      <path d="M10 17h4v3h-4z" />
    </svg>
  );
}

/** A speaker — the announcer toggle, on state. */
export function SpeakerIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 9v6h4l5 5V4L8 9z" />
      <path d="M17 8a5 5 0 0 1 0 8" />
      <path d="M19.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

/** A speaker with a slash — the announcer toggle, muted state. */
export function SpeakerMuteIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 9v6h4l5 5V4L8 9z" />
      <path d="M16 9l5 6M21 9l-5 6" />
    </svg>
  );
}

/** A name-tag/guest-pass shape — the "Legg til gjest" action and guest avatars. */
export function GuestIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 8a2 2 0 0 1 2-2h9l7 6-7 6H5a2 2 0 0 1-2-2z" />
      <circle cx="8" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A single figure — the Individuelt mode toggle. */
export function PersonIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

/** Two overlapping figures — the Lag mode toggle. */
export function PeopleIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.8" />
      <path d="M16.5 14.2a5.5 5.5 0 0 1 4 5.8" />
    </svg>
  );
}
