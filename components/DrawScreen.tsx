"use client";

import { useEffect, useMemo, useState } from "react";
import { firstRoundPairs, openDraw, swapEntrants } from "@/lib/knockout";
import type { Participant } from "@/lib/tournament";
import { ScreenTop } from "./ScreenTop";
import { StickyAction } from "./StickyAction";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type Mode = "seeded" | "open";

/** A new seed for each open draw. */
const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * The draw, before the tournament exists: who meets whom in the first round, revealed pair by pair. Seeded puts the strongest
 * apart (1 meets the lowest, with byes for the top seeds); an open draw shuffles everyone, as many times as it takes. Two names
 * can be swapped by tapping one and then the other.
 */
export function DrawScreen({
  seeded,
  cupName,
  onBack,
  onStart,
}: {
  /** The entrants strongest first. */
  seeded: Participant[];
  cupName?: string;
  onBack: () => void;
  onStart: (order: Participant[]) => void;
}) {
  const [mode, setMode] = useState<Mode>("seeded");
  const [order, setOrder] = useState<Participant[]>(seeded);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [round, setRound] = useState(0);
  const pairs = useMemo(() => firstRoundPairs(order.map((p) => p.name)), [order]);

  // Each draw shows its pairs one at a time. The pause is short: the point is that it is a draw, not that anyone waits.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setRevealed(pairs.length), 0);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= pairs.length; i++) timers.push(setTimeout(() => setRevealed(i), 380 * i));
    return () => timers.forEach(clearTimeout);
  }, [round, pairs.length]);

  function choose(next: Mode) {
    setMode(next);
    setPicked(null);
    setOrder(next === "seeded" ? seeded : openDraw(seeded, freshSeed()));
    setRevealed(0);
    setRound((r) => r + 1);
  }

  function again() {
    setMode("open");
    setPicked(null);
    setOrder(openDraw(seeded, freshSeed()));
    setRevealed(0);
    setRound((r) => r + 1);
  }

  function tap(name: string | null) {
    if (!name) return;
    const i = order.findIndex((p) => p.name === name);
    if (i === -1) return;
    if (picked === null) setPicked(i);
    else if (picked === i) setPicked(null);
    else {
      setOrder(swapEntrants(order, picked, i));
      setPicked(null);
    }
  }

  const seedNo = (name: string) => (mode === "seeded" ? `#${order.findIndex((p) => p.name === name) + 1}` : "");
  const slot = (name: string | null, shown: boolean) =>
    name ? (
      <button
        type="button"
        onClick={() => tap(name)}
        aria-pressed={picked !== null && order[picked].name === name}
        className={`flex-1 min-w-0 text-left px-3 rounded-lg ${FOCUS_RING}`}
        style={{
          minHeight: "2.75rem",
          background: picked !== null && order[picked].name === name ? "var(--teal-soft, rgba(52,195,210,0.16))" : "var(--color-cell)",
          border: picked !== null && order[picked].name === name ? "1px solid var(--color-teal)" : "1px solid transparent",
          color: "var(--color-cream)",
          opacity: shown ? 1 : 0,
          transform: shown ? "none" : "translateY(6px)",
          transition: "opacity 260ms ease, transform 260ms ease",
        }}
      >
        <span className="tabular" style={{ color: "var(--color-muted)", fontSize: "0.75rem", marginRight: "0.4rem" }}>
          {seedNo(name)}
        </span>
        <span className="truncate">{name}</span>
      </button>
    ) : (
      <span className="flex-1 px-3 flex items-center" style={{ minHeight: "2.75rem", color: "var(--color-muted)", fontStyle: "italic", fontSize: "0.85rem", opacity: shown ? 1 : 0, transition: "opacity 260ms ease" }}>
        walkover videre
      </span>
    );

  return (
    <div className="animate-screen-enter screen has-sticky-action" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Trekningen" onBack={onBack} backLabel="← Tilbake" />
        {cupName && (
          <p className="text-center mb-4" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
            {cupName}
          </p>
        )}
        <div className="flex gap-2 mb-4" role="radiogroup" aria-label="Type trekning">
          {(["seeded", "open"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => choose(m)}
              className={`tactile flex-1 rounded-lg font-medium ${FOCUS_RING}`}
              style={{ minHeight: "2.75rem", background: mode === m ? "var(--teal-soft)" : "var(--color-surface)", color: mode === m ? "var(--color-teal)" : "var(--color-muted)", border: mode === m ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
            >
              {m === "seeded" ? "Seedet" : "Åpen trekning"}
            </button>
          ))}
        </div>
        <p className="mb-3" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
          {mode === "seeded" ? "De sterkeste møtes sent: nummer 1 mot den svakeste, og de beste får walkover når tallet ikke går opp." : "Alle trekkes tilfeldig. Trykk på to navn for å bytte plass."}
        </p>
        <div className="space-y-2 mb-4">
          {pairs.map((p, i) => (
            <div key={`${round}-${i}`} className="flex items-center gap-2 rounded-xl p-2" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
              {slot(p.a, i < revealed)}
              <span className="font-display" style={{ color: "var(--color-muted)", opacity: i < revealed ? 1 : 0 }}>
                mot
              </span>
              {slot(p.b, i < revealed)}
            </div>
          ))}
        </div>
        {mode === "open" && (
          <div className="flex justify-center mb-4">
            <button type="button" onClick={again} className={`tactile px-4 rounded-lg text-sm ${FOCUS_RING}`} style={{ minHeight: "2.75rem", color: "var(--color-cream)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              Trekk på nytt
            </button>
          </div>
        )}
        <StickyAction onClick={() => onStart(order)} ready summary={`${order.length} med${mode === "seeded" ? ", seedet" : ", åpen trekning"}`} reason={null}>
          Start turneringen
        </StickyAction>
      </div>
    </div>
  );
}
