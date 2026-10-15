"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ScoliaDot } from "./ScoliaStatusBadge";
import { ToastSlot } from "./ErrorToastStack";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The top of every screen except the board: a way back on the left, the title in the middle and
 * one thing on the right — an action, the board's status as a dot, or nothing. Same height (44 px)
 * and same title size everywhere, so the screens read as one app. Before this each screen built
 * its own: titles in four sizes, Hjem in three heights, and the Scolia badge floating over
 * whatever happened to be in the corner.
 */
export function ScreenTop({
  title,
  onBack,
  backHref,
  backLabel = "← Hjem",
  right,
  scolia,
}: {
  title: ReactNode;
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  /** What sits on the right. Omitted: an empty slot the same width, so the title stays centred. */
  right?: ReactNode;
  /** The board's status, shown as a dot in the right slot when nothing else is there. */
  scolia?: { label: string; color: string } | null;
}) {
  const backClass = `tactile inline-flex items-center justify-center rounded-lg text-sm ${FOCUS_RING}`;
  const backStyle = { background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", minHeight: "2.75rem", minWidth: "4.5rem", padding: "0 0.75rem" } as const;
  return (
    <>
    <div className="screen-top flex items-center justify-between gap-2 mb-4">
      {backHref ? (
        <Link href={backHref} className={backClass} style={backStyle}>
          {backLabel}
        </Link>
      ) : onBack ? (
        <button type="button" onClick={onBack} className={backClass} style={backStyle}>
          {backLabel}
        </button>
      ) : (
        <span style={{ minWidth: "4.5rem" }} aria-hidden />
      )}
      <h1 className="page-title truncate text-center flex-1 min-w-0">{title}</h1>
      <div className="flex items-center justify-end" style={{ minWidth: "4.5rem", minHeight: "2.75rem" }}>
        {right ?? (scolia ? <ScoliaDot summary={scolia} /> : null)}
      </div>
    </div>
    {/* A failed save shows up here, in the flow, rather than floating over the title. */}
    <ToastSlot />
    </>
  );
}
