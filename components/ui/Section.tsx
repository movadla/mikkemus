import type { ReactNode } from "react";

/** A group on a screen: a small spaced label above, the content below. Left-aligned everywhere. */
export function Section({ label, aside, children }: { label?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-3 mb-2">
          {label ? <h2 className="section-label">{label}</h2> : <span />}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
