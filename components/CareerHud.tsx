"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { dollars, type Career } from "@/lib/career";
import { rankOf } from "@/lib/careerGoals";
import { CoinIcon, TrophyIcon } from "./icons";
import { StarIcon } from "./careerIcons";
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
 * A small mark of where the progress is: "Lagret" for a moment after every save, and a standing note when there is no network that it is safe on
 * the phone. The player never has to wonder whether the career is kept.
 */
function SaveChip({ savedAt }: { savedAt: string }) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const fresh = now - Date.parse(savedAt) < 3500;
  if (!fresh && online) return null;
  return (
    <span role="status" className="inline-flex items-center gap-1.5" style={{ fontSize: "var(--text-micro)", color: "var(--color-muted)" }}>
      <span aria-hidden style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: online ? "var(--color-green)" : "var(--color-gold)" }} />
      {online ? "Lagret" : "Ingen nett: lagret på telefonen"}
    </span>
  );
}

/**
 * The line that is always up in the career: the money, the ranking points and the titles, as chips with an icon each, and the player's title
 * under it. It sits in the top of the screen, so it is still there when the page scrolls, and it is the one place the money is shown.
 */
export function CareerHud({ career }: { career: Career }) {
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
  const chip = { padding: "0.2rem 0.6rem", borderRadius: "var(--radius-pill)", background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: "var(--text-small)", fontWeight: 700 } as const;
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Status">
      <span key={delta === null ? "still" : career.money} className={`relative inline-flex items-center gap-1 tabular ${delta !== null && delta > 0 ? "hud-pop" : ""}`} style={{ ...chip, color: "var(--color-gold-strong)" }} title="Saldo">
        {delta !== null && delta !== 0 && (
          <span className="hud-delta" style={{ color: delta > 0 ? "var(--color-green)" : "var(--color-red)" }}>
            {delta > 0 ? "+" : "−"}
            {dollars(Math.abs(delta))}
          </span>
        )}
        <CoinIcon className="w-4 h-4" />
        <CountUp value={career.money} format={dollars} />
      </span>
      <span className="inline-flex items-center gap-1 tabular" style={{ ...chip, color: "var(--color-teal)" }} title="Rankingpoeng">
        <StarIcon className="w-4 h-4" />
        <CountUp value={career.points} />
      </span>
      <span className="inline-flex items-center gap-1 tabular" style={{ ...chip, color: "var(--color-cream)" }} title="Titler">
        <TrophyIcon className="w-4 h-4" />
        {career.titles}
      </span>
      <span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{rankOf(career)}</span>
      <SaveChip savedAt={career.savedAt} />
    </div>
  );
}
