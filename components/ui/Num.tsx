import type { ReactNode } from "react";

/**
 * A figure the way the app writes one: the whole number big, in the display face with figures of equal width (so it does not shift
 * when it changes), and what goes with it (a unit, a decimal part) small and quiet after it.
 */
export function Num({ value, unit, size = "num" }: { value: ReactNode; unit?: ReactNode; size?: "num" | "title" }) {
  return (
    <span className="num" style={{ fontSize: `var(--text-${size})` }}>
      {value}
      {unit !== undefined && <span className="num-unit">{unit}</span>}
    </span>
  );
}
