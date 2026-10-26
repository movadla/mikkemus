const STEPS = ["Oppsett", "Trekning", "Turnering"];

/** Where in the making of a tournament this screen is: setup, the draw, then the tournament itself. */
export function StepStrip({ step }: { step: 0 | 1 | 2 }) {
  return (
    <ol aria-label="Steg" className="flex items-center justify-center gap-2 mb-4 list-none p-0" style={{ fontSize: "0.75rem" }}>
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === step ? "step" : undefined}
          className="flex items-center gap-2"
          style={{ color: i === step ? "var(--color-teal)" : i < step ? "var(--color-cream)" : "var(--color-muted)", fontWeight: i === step ? 700 : 400 }}
        >
          <span aria-hidden style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: i <= step ? "var(--color-teal)" : "var(--color-border)" }} />
          {label}
          {i < STEPS.length - 1 && (
            <span aria-hidden style={{ color: "var(--color-border)" }}>
              —
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
