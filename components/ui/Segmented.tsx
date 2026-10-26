"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { digitIndex, nextIndex } from "@/lib/arrowNav";
import { uiFeedback } from "@/lib/uiSound";
import { FOCUS_RING } from "./focus";

/**
 * Two to five options in one box, one of them on: the tabs of a page, Vanlig / Mot boter, the animation level.
 * It scrolls sideways rather than squeezing when there is no room.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  /** Spoken name of the group. */
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  // The chosen one is always in view, however far along a long row it sits.
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[aria-checked=true]")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [value]);
  // Left and Right move the choice, and 1 to 9 take the option in that place: the keyboard of a radio group.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const at = options.findIndex((o) => o.value === value);
    const to = e.key === "ArrowLeft" || e.key === "ArrowRight" ? nextIndex(e.key, at, options.length) : digitIndex(e.key, options.length);
    if (to === null || to === at) return;
    e.preventDefault();
    uiFeedback("pick");
    onChange(options[to].value);
    box.current?.querySelectorAll<HTMLElement>("[role=radio]")[to]?.focus();
  }
  return (
    <div
      ref={box}
      onKeyDown={onKeyDown}
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 p-1 overflow-x-auto"
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-m)", scrollbarWidth: "none" }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (!selected) uiFeedback("pick");
              onChange(o.value);
            }}
            className={`flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 font-semibold ${FOCUS_RING}`}
            style={{
              minHeight: "var(--control)",
              borderRadius: "var(--radius-s)",
              fontSize: "var(--text-body)",
              background: selected ? "var(--teal-soft)" : "transparent",
              color: selected ? "var(--color-teal)" : "var(--color-muted)",
              boxShadow: selected ? "inset 0 0 0 1px var(--teal-ring)" : "none",
              transition: "background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)",
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
