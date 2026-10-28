"use client";

import type { ReactNode } from "react";
import { FOCUS_RING } from "./ui/focus";

/** A round icon button with one word under it, and a red dot when there is something new behind it. The four places of the home screen are these. */
export function RoundButton({ icon, label, badge = false, onClick }: { icon: ReactNode; label: string; badge?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`round-btn tactile ${FOCUS_RING}`} aria-label={badge ? `${label}, nytt` : label}>
      <span className="round-btn-disc">
        {icon}
        {badge && <b className="round-btn-dot" aria-hidden />}
      </span>
      <span className="round-btn-label">{label}</span>
    </button>
  );
}
