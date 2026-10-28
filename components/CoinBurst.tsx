"use client";

import { useEffect } from "react";
import { careerSound } from "@/lib/uiSound";
import { haptics } from "@/lib/haptics";
import { CoinIcon } from "./icons";

const COINS = Array.from({ length: 9 }, (_, i) => i);

/**
 * Money that arrives: a handful of coins that rise from the middle of the screen and fly up towards the balance, with the ring of a coin and a
 * light touch. It plays once when it appears and does not take part in the layout, so it can be placed anywhere on a screen.
 */
export function CoinBurst({ delay = 0.6 }: { delay?: number }) {
  useEffect(() => {
    const t = setTimeout(() => {
      careerSound("coin");
      haptics.confirm();
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className="coin-burst" aria-hidden>
      {COINS.map((i) => (
        <span key={i} className="coin-burst-coin" style={{ "--dx": `${(i - 4) * 14}px`, "--d": `${delay + i * 0.07}s`, "--rot": `${(i % 2 ? 1 : -1) * 40}deg` } as React.CSSProperties}>
          <CoinIcon className="w-6 h-6" />
        </span>
      ))}
    </div>
  );
}
