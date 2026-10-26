import type { CSSProperties, ReactNode } from "react";

/**
 * The one card, in three levels. Flat groups things on the ground; raised holds a result or an action and has a shadow;
 * gold is for what has been earned (a winner, a record) and nothing else. Same corners and the same padding on all three.
 */
export function Card({
  level = "raised",
  children,
  className = "",
  style,
}: {
  level?: "flat" | "raised" | "gold";
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const base = level === "flat" ? "card-flat" : level === "gold" ? "card-gold card-gold-pad" : "card-raised";
  return (
    <div className={`${base} ${className}`} style={style}>
      {children}
    </div>
  );
}
