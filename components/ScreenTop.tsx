"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "./icons";
import { ScoliaDot } from "./ScoliaStatusBadge";
import { ToastSlot } from "./ErrorToastStack";
import { FOCUS_RING } from "./ui/focus";

/**
 * The top of every screen except the board. The title stands on the left, large; a way back is an arrow in front of it, on the
 * pages you have gone into (the pages of the bottom bar have none); and one thing sits on the right: an action, the board's
 * status as a dot, or nothing. Same height and same title size everywhere. A long title takes two lines rather than being cut.
 */
export function ScreenTop({
  title,
  onBack,
  backHref,
  backLabel = "Tilbake",
  right,
  scolia,
}: {
  title: ReactNode;
  onBack?: () => void;
  backHref?: string;
  /** Spoken name of the arrow. The arrow itself carries no text. */
  backLabel?: string;
  /** What sits on the right. */
  right?: ReactNode;
  /** The board's status, shown as a dot in the right slot when nothing else is there. */
  scolia?: { label: string; color: string } | null;
}) {
  const label = backLabel.replace(/^←\s*/, "");
  const backClass = `tactile inline-flex items-center justify-center shrink-0 ${FOCUS_RING}`;
  const backStyle = { background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-m)" } as const;
  const rightSlot = right ?? (scolia ? <ScoliaDot summary={scolia} /> : null);
  return (
    <>
      <div className="screen-top flex items-center gap-3 mb-4" style={{ minHeight: "var(--control)" }}>
        {backHref ? (
          <Link href={backHref} aria-label={label} className={backClass} style={backStyle}>
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
        ) : onBack ? (
          <button type="button" onClick={onBack} aria-label={label} className={backClass} style={backStyle}>
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        ) : null}
        <h1 className="page-title flex-1 min-w-0 line-clamp-2" style={{ lineHeight: 1.15 }}>
          {title}
        </h1>
        {rightSlot && <div className="flex items-center justify-end shrink-0">{rightSlot}</div>}
      </div>
      {/* A failed save shows up here, in the flow, rather than floating over the title. */}
      <ToastSlot />
    </>
  );
}
