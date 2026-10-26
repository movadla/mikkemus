"use client";

import { useId, type ReactNode } from "react";
import { CloseIcon } from "../icons";
import { FOCUS_RING } from "./focus";

const fieldStyle = (invalid: boolean) =>
  ({
    minHeight: "var(--control)",
    borderRadius: "var(--radius-s)",
    background: "var(--color-surface)",
    color: "var(--color-cream)",
    border: `1px solid ${invalid ? "var(--color-red)" : "var(--color-border)"}`,
    fontSize: "var(--text-body)",
  }) as const;

/**
 * The one text field: a label above (or none, when the placeholder says it), the same height, border and focus everywhere, and
 * one place for what is wrong with it, in red under the box and read out to a screen reader.
 */
export function TextField({
  value,
  onChange,
  label,
  placeholder,
  error,
  maxLength,
  autoFocus,
  onEnter,
  hideLabel = false,
  trailing,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  error?: string;
  maxLength?: number;
  autoFocus?: boolean;
  onEnter?: () => void;
  /** The label is spoken but not shown (the placeholder or the layout already says it). */
  hideLabel?: boolean;
  /** Something at the end of the box, such as a button. */
  trailing?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="w-full">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "section-label block mb-2"}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`flex-1 min-w-0 px-4 ${FOCUS_RING}`}
          style={fieldStyle(!!error)}
        />
        {trailing}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2" style={{ color: "var(--color-red)", fontSize: "var(--text-micro)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** A search box: the same field with a clear button once there is something to clear. */
export function SearchField({ value, onChange, label = "Søk", placeholder = "Søk" }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="relative w-full">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 pr-11 ${FOCUS_RING}`}
        style={fieldStyle(false)}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Tøm søket" className={`absolute right-0 top-0 flex items-center justify-center ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", color: "var(--color-muted)" }}>
          <CloseIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/** A number up or down by one, between a lowest and a highest: how many crosses, how many players. */
export function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  const btn = `tactile flex items-center justify-center ${FOCUS_RING}`;
  const box = { width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-s)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" } as const;
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} style={{ ...box, opacity: value <= min ? 0.4 : 1 }} disabled={value <= min} aria-label={`${label}: færre`} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="tabular text-center" style={{ minWidth: "2.5rem", fontSize: "var(--text-title)", fontFamily: "var(--font-display)", color: "var(--color-cream)" }} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} style={{ ...box, opacity: value >= max ? 0.4 : 1 }} disabled={value >= max} aria-label={`${label}: flere`} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
