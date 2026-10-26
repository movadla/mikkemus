"use client";

import { useEffect, useRef, useState } from "react";
import { getFxLevel } from "@/lib/fxLevel";

/**
 * A figure that counts up to its value when it appears (about 0.6 s), so a rating or a hit rate arrives instead of just being there.
 * Not for anyone who has asked for less movement, and not in Enkel: those get the figure at once.
 */
export function CountUp({ value, format = (n) => String(n), ms = 600 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || getFxLevel() === "simple") {
      const t = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(t);
    }
    const start = performance.now();
    const origin = from.current === value ? 0 : from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // Fast at first and slow at the end, so the last digits settle rather than slam.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(origin + (value - origin) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, ms]);
  return <span className="tabular">{format(Math.round(shown))}</span>;
}
