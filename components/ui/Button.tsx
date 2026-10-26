"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { haptics } from "@/lib/haptics";
import { FOCUS_RING } from "./focus";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/**
 * The one button. Primary is the single teal call to action of a screen, secondary a quiet button on a surface, ghost has no
 * box, danger is red and for what cannot be taken back. Two heights (44 and 56 px), always the same corners.
 * With `href` it is a link that looks the same.
 */
export function Button({
  children,
  variant = "secondary",
  size = "md",
  block = false,
  icon,
  onClick,
  href,
  disabled,
  type = "button",
  label,
  className = "",
  style,
}: {
  children?: ReactNode;
  variant?: Variant;
  size?: "md" | "lg";
  /** Fill the width of the parent. */
  block?: boolean;
  /** An icon before the text. */
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  /** Spoken name when there is no text, as on an icon button. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const primary = variant === "primary";
  const base = `${primary ? "glossy" : "tactile"} ${block ? "w-full" : ""} inline-flex items-center justify-center gap-2 font-semibold ${FOCUS_RING} ${className}`;
  const look: CSSProperties = {
    minHeight: size === "lg" ? "var(--control-lg)" : "var(--control)",
    minWidth: "var(--control)",
    padding: children ? "0 1rem" : 0,
    borderRadius: "var(--radius-m)",
    fontSize: size === "lg" ? "var(--text-title)" : "var(--text-body)",
    opacity: disabled ? 0.4 : 1,
    ...(primary
      ? ({ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)" } as CSSProperties)
      : variant === "danger"
        ? { background: "var(--color-surface)", color: "var(--color-red)", border: "1px solid var(--color-border)" }
        : variant === "ghost"
          ? { background: "transparent", color: "var(--color-muted)" }
          : { background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }),
    ...style,
  };
  const content = (
    <>
      {icon}
      {children}
    </>
  );
  if (href && !disabled) {
    return (
      <Link href={href} aria-label={label} className={base} style={look}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={() => {
        haptics.tick();
        onClick?.();
      }}
      disabled={disabled} aria-label={label} className={base} style={look}>
      {content}
    </button>
  );
}
