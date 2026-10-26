import { avatarAccent } from "@/lib/avatarAccent";

/** Skin, hair and the dark of the eyes: art, so the colours are written out here (see COLOUR_LITERALS in lib/designRules.test.ts). */
const SKIN = ["#f3d2b3", "#e2b48a", "#c88f64", "#a06a45", "#7a4b2d"];
const HAIR = ["#2b2118", "#5a3b22", "#9b6a34", "#c9a45c", "#8e8e8e"];
const INK = "#2b2118";

function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * A face for a bot, made from its name: the same name is always the same person. Skin, hair colour and style, and a shirt in the
 * colour that name has everywhere else in the app (see avatarAccent). Drawn to fill a round avatar.
 */
export function BotFace({ name, className }: { name: string; className?: string }) {
  const h = hash(name);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[Math.floor(h / 5) % HAIR.length];
  const style = Math.floor(h / 25) % 5;
  const shirt = avatarAccent(name);
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M8 64c0-13 10-19 24-19s24 6 24 19z" style={{ fill: shirt }} />
      <rect x="27" y="38" width="10" height="9" rx="3" fill={skin} />
      {style === 2 && <path d="M16 32C14 10 50 10 48 32l0 14h-6V30H22v16h-6z" fill={hair} />}
      <ellipse cx="32" cy="29" rx="13.5" ry="15" fill={skin} />
      {style === 0 && <path d="M18.5 28C17 9 47 9 45.5 28c-3-7-8-9-13.500-9S21.500 21 18.500 28z" fill={hair} />}
      {style === 1 && <path d="M18.500 25c2-9 25-9 27 0-6-4-21-4-27 0z" fill={hair} />}
      {style === 3 && (
        <>
          <path d="M18 26c0-12 28-12 28 0z" style={{ fill: shirt }} />
          <rect x="16" y="24.500" width="32" height="4" rx="2" style={{ fill: shirt }} />
        </>
      )}
      {style === 4 && (
        <>
          <circle cx="23" cy="17" r="6.500" fill={hair} />
          <circle cx="32" cy="14" r="7" fill={hair} />
          <circle cx="41" cy="17" r="6.500" fill={hair} />
        </>
      )}
      <circle cx="26.500" cy="30" r="1.600" fill={INK} />
      <circle cx="37.500" cy="30" r="1.600" fill={INK} />
      <path d="M27 37c3 3 7 3 10 0" stroke={INK} strokeWidth="1.600" strokeLinecap="round" fill="none" />
    </svg>
  );
}
