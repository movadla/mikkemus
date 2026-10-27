"use client";

import { useEffect, useRef, useState } from "react";

/** A number that rolls to its new value instead of jumping: about two thirds of a second, easing out. With reduced motion it just changes. */
export function RollingNumber({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const from = shownRef.current;
    if (reduce || from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 650);
      const eased = 1 - Math.pow(1 - k, 3);
      shownRef.current = Math.round(from + (value - from) * eased);
      setShown(shownRef.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  return (
    <span className={className} style={style}>
      {reduce ? value : shown}
    </span>
  );
}
