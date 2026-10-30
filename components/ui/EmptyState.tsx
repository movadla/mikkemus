import type { ReactNode } from "react";

/** A list or page with nothing in it yet: a small icon, one sentence and, when there is something to do, the one button. */
export function EmptyState({ icon, title, action, hint }: { icon?: ReactNode; title: string; action?: ReactNode; /** One line of what happens next. */ hint?: string }) {
  return (
    <div className="empty-card flex flex-col items-center text-center gap-3 my-6" style={{ color: "var(--color-muted)" }}>
      {icon && (
        <span className="flex items-center justify-center" style={{ width: "3.5rem", height: "3.5rem", borderRadius: "50%", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          {icon}
        </span>
      )}
      <p style={{ fontSize: "var(--text-body)", color: "var(--color-cream)", fontWeight: 600 }}>{title}</p>
      {hint && <p style={{ fontSize: "var(--text-small)", color: "var(--color-muted)" }}>{hint}</p>}
      {action}
    </div>
  );
}
