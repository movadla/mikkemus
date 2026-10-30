const STEPS = ["Oppsett", "Trekning", "Turnering"];

/** Where in the making of a tournament this screen is: setup, the draw, then the tournament itself. The career has no setup: its strip is the draw and the tournament. */
export function StepStrip({ step, steps = STEPS }: { step: 0 | 1 | 2; steps?: string[] }) {
  return (
    <ol aria-label="Steg" className="step-pill flex items-center justify-center gap-2 mb-4 list-none" style={{ fontSize: "var(--text-micro)" }}>
      {steps.map((label, i) => (
        <li
          key={label}
          aria-current={i === step ? "step" : undefined}
          className="flex items-center gap-2"
          style={{ color: i === step ? "var(--color-teal)" : i < step ? "var(--color-cream)" : "var(--color-muted)", fontWeight: i === step ? 700 : 400 }}
        >
          <span aria-hidden style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: i <= step ? "var(--color-teal)" : "var(--color-border)" }} />
          {label}
          {i < steps.length - 1 && (
            <span aria-hidden style={{ color: "var(--color-border)" }}>
              —
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
