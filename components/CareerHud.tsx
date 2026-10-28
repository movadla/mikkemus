"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { dollars, type Career } from "@/lib/career";
import { ArrowLeftIcon } from "./icons";
import { FOCUS_RING } from "./ui/focus";
import { CountUp } from "./ui/CountUp";

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/**
 * A dot that says the career is kept: green for a moment after every save, and gold with a word when there is no network (it is then safe on
 * the phone). Nothing is written out, so there is nothing to read.
 */
function SaveDot({ savedAt }: { savedAt: string }) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const fresh = now - Date.parse(savedAt) < 3500;
  if (!fresh && online) return null;
  return (
    <span role="status" className="inline-flex items-center gap-1" aria-label={online ? "Lagret" : "Offline: lagret på telefonen"} style={{ fontSize: "var(--text-micro)", color: "var(--color-muted)" }}>
      <span aria-hidden style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: online ? "var(--color-green)" : "var(--color-gold)" }} />
      {!online && "Offline"}
    </span>
  );
}

/**
 * The line at the top of every screen of the career: the money on the left, the level as a star and a number on the right, and what goes
 * with it (the menu) at the end. It is the only place the money is written. A gain pops the chip and floats the amount above it.
 */
export function CareerHud({ career, end, onBack, title }: { career: Career; end?: ReactNode; /** On a screen behind a button: the way back, and what the screen is called. */ onBack?: () => void; title?: string }) {
  const [delta, setDelta] = useState<number | null>(null);
  const [prev, setPrev] = useState(career.money);
  if (career.money !== prev) {
    // Money came in (or went out): the chip says by how much, for a moment.
    setPrev(career.money);
    setDelta(career.money - prev);
  }
  useEffect(() => {
    if (delta === null) return;
    const t = setTimeout(() => setDelta(null), 1500);
    return () => clearTimeout(t);
  }, [delta]);
  const coin = (
    <span key={delta === null ? "still" : career.money} className={`hud-coin relative tabular ${delta !== null && delta > 0 ? "hud-pop" : ""}`} title="Saldo">
        {delta !== null && delta !== 0 && (
          <span className={`hud-delta ${delta < 0 ? "hud-delta-out" : ""}`} style={{ color: delta > 0 ? "var(--color-green)" : "var(--color-red)" }}>
            {delta > 0 ? "+" : "−"}
            {dollars(Math.abs(delta))}
          </span>
        )}
        <span className="coin-mark" aria-hidden />
        <span className="coin-figure">
          <CountUp value={career.money} format={dollars} />
        </span>
    </span>
  );
  if (onBack) {
    return (
      <div className="flex items-center gap-3" role="group" aria-label="Status">
        <button type="button" onClick={onBack} aria-label="Tilbake" className={`tactile inline-flex items-center justify-center shrink-0 ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-pill)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="font-display flex-1 min-w-0 truncate" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)", lineHeight: 1.1 }}>
          {title}
        </h1>
        {coin}
        <SaveDot savedAt={career.savedAt} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Status">
      {coin}
      <SaveDot savedAt={career.savedAt} />
      <span className="flex-1" />
      {end}
    </div>
  );
}
