"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "../icons";
import { FOCUS_RING } from "./focus";

/**
 * The row of every list: something at the start (an avatar, a number, an icon), a title and a line under it, a value at the
 * end and, when it can be opened, a chevron. The title takes two lines rather than being cut off.
 */
export function Row({
  leading,
  title,
  subtitle,
  value,
  trailing,
  bigValue = false,
  onClick,
  href,
  selected,
  tone = "default",
  accent,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** What sits at the end: a figure, a result, a date. */
  value?: ReactNode;
  /** Something between the text and the value: a small curve, a badge. */
  trailing?: ReactNode;
  /** The value is the point of the row: in the display face and large. */
  bigValue?: boolean;
  onClick?: () => void;
  href?: string;
  selected?: boolean;
  /** Gold is for what has been earned: a winner, a record. */
  tone?: "default" | "gold";
  /** A colour for the stripe along the start of the row: a player's own (see avatarAccent). */
  accent?: string;
}) {
  const opens = !!onClick || !!href;
  const style = {
    minHeight: "var(--control-lg)",
    borderRadius: "var(--radius-m)",
    background: tone === "gold" ? "var(--gold-soft)" : selected ? "var(--teal-soft)" : "var(--color-surface)",
    border: `1px solid ${tone === "gold" ? "var(--gold-ring)" : selected ? "var(--color-teal)" : "var(--color-border)"}`,
    color: "var(--color-cream)",
    padding: "0.5rem 0.75rem",
    boxShadow: "var(--elevation-1)",
    ...(accent ? { borderLeft: `4px solid ${accent}` } : {}),
  } as const;
  const body = (
    <>
      {leading && <span className="shrink-0 flex items-center justify-center">{leading}</span>}
      <span className="flex-1 min-w-0 flex flex-col text-left">
        <span className="line-clamp-2" style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>
          {title}
        </span>
        {subtitle && (
          <span className="line-clamp-1" style={{ fontSize: "var(--text-micro)", color: "var(--color-muted)" }}>
            {subtitle}
          </span>
        )}
      </span>
      {trailing && <span className="shrink-0 flex items-center">{trailing}</span>}
      {value !== undefined && (
        <span className={`shrink-0 tabular ${bigValue ? "num" : ""}`} style={{ fontSize: bigValue ? "var(--text-num)" : "var(--text-body)", fontWeight: bigValue ? 700 : 600, color: tone === "gold" ? "var(--color-gold-strong)" : "var(--color-teal)" }}>
          {value}
        </span>
      )}
      {opens && <ChevronRightIcon className="w-4 h-4 shrink-0" />}
    </>
  );
  const cls = `${opens ? "tactile" : ""} flex items-center gap-3 w-full min-w-0 ${FOCUS_RING}`;
  // data-nav marks what the arrow keys move between (see useArrowNav).
  if (href) {
    return (
      <Link href={href} className={cls} style={style} data-nav>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style} data-nav>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}
