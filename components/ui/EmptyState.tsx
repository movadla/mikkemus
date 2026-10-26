import type { ReactNode } from "react";

/** A list or page with nothing in it yet: a small icon, one sentence and, when there is something to do, the one button. */
export function EmptyState({ icon, title, action }: { icon?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-10" style={{ color: "var(--color-muted)" }}>
      {icon && (
        <span className="flex items-center justify-center" style={{ width: "3.5rem", height: "3.5rem", borderRadius: "50%", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          {icon}
        </span>
      )}
      <p style={{ fontSize: "var(--text-body)", color: "var(--color-text-2)" }}>{title}</p>
      {action}
    </div>
  );
}
