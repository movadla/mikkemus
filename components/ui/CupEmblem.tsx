import type { CupKind } from "@/lib/botCup";

/**
 * The emblem of a cup, drawn in the cup's own colour: a globe for the VM, a star for the EM, a crown for Grand Slam, a shield for
 * the NM and a house for Ly Pilotturnering. Plain line drawings in the same style as the rest of the icons.
 */
export function CupEmblem({ kind, className = "w-5 h-5" }: { kind: CupKind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {kind === "vm" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3 12h18" />
        </>
      )}
      {kind === "em" && <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />}
      {kind === "gs" && (
        <>
          <path d="M4 18h16" />
          <path d="m4 18-1-9 5 4 4-7 4 7 5-4-1 9" />
        </>
      )}
      {kind === "nm" && <path d="M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6z" />}
      {kind === "open" && (
        <>
          <path d="m3 11 9-7 9 7" />
          <path d="M5.5 10v10h13V10" />
          <path d="M10 20v-5.5h4V20" />
        </>
      )}
    </svg>
  );
}
