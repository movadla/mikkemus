"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { digitIndex, nextIndex } from "@/lib/arrowNav";
import { uiFeedback } from "@/lib/uiSound";
import { ChevronRightIcon } from "../icons";
import { FOCUS_RING } from "./focus";

/**
 * Two to five options in one box, one of them on: the tabs of a page, Vanlig / Mot boter, the animation level.
 * Pills in a row. It scrolls sideways rather than squeezing when there is no room, and says so: the edge where there is more fades out and
 * carries an arrow that moves the row on.
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
  // Where there is more to scroll to, one side at a time.
  const [more, setMore] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const b = box.current;
    if (!b) return;
    setMore({ left: b.scrollLeft > 4, right: b.scrollLeft + b.clientWidth < b.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, options.length]);
  // The chosen one is always in view, however far along a long row it sits.
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[aria-checked=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
    measure();
  }, [value, measure]);
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
  const fade = more.left && more.right ? "seg-fade-both" : more.right ? "seg-fade-right" : more.left ? "seg-fade-left" : "";
  return (
    <div className="relative">
    <div
      ref={box}
      onKeyDown={onKeyDown}
      onScroll={measure}
      role="radiogroup"
      aria-label={label}
      className={`flex gap-2 p-1 overflow-x-auto ${fade}`}
      style={{ scrollbarWidth: "none" }}
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
            className={`flex-1 inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 font-semibold ${FOCUS_RING}`}
            style={{
              minHeight: "var(--control)",
              borderRadius: "var(--radius-pill)",
              fontSize: "var(--text-body)",
              background: selected ? "var(--color-teal)" : "var(--color-surface)",
              color: selected ? "var(--color-bg)" : "var(--color-text-2)",
              border: selected ? "1px solid transparent" : "1px solid var(--color-border)",
              boxShadow: selected ? "var(--elevation-1), 0 4px 14px -4px var(--teal-ring)" : "none",
              transition: "background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)",
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
      {more.right && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Flere valg"
          onClick={() => box.current?.scrollBy({ left: box.current.clientWidth * 0.6, behavior: "smooth" })}
          className="tactile absolute flex items-center justify-center"
          style={{ right: 4, top: "50%", transform: "translateY(-50%)", width: "1.75rem", height: "1.75rem", borderRadius: "50%", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-teal)" }}
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
