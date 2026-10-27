"use client";

import { useEffect, useMemo, useState } from "react";
import { firstRoundPairs, openDraw, swapEntrants } from "@/lib/knockout";
import type { Participant } from "@/lib/tournament";
import { ScreenTop } from "./ScreenTop";
import { StepStrip } from "./StepStrip";
import { CupBanner } from "./CupBanner";
import { cupColor, type CupConfig } from "@/lib/botCup";
import { MiniBracket } from "./MiniBracket";
import { StickyAction } from "./StickyAction";
import { Button } from "./ui/Button";
import { CupEmblem } from "./ui/CupEmblem";
import { TrophyIcon } from "./icons";
import { drawSound } from "@/lib/uiSound";
import { publishShow } from "@/lib/liveMatch";

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
  summary,
  cup,
  onBack,
  onStart,
}: {
  /** The entrants strongest first. */
  seeded: Participant[];
  /** What is being drawn for, in a line; tapping it goes back to the setup. */
  summary?: string;
  /** The cup being drawn, shown as its title card. */
  cup?: CupConfig;
  onBack: () => void;
  onStart: (order: Participant[]) => void;
}) {
  const [mode, setMode] = useState<Mode>("seeded");
  const [order, setOrder] = useState<Participant[]>(seeded);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [round, setRound] = useState(0);
  // The draw that has been skipped to its end (by its number), so a new draw plays out again.
  const [skipped, setSkipped] = useState(-1);
  const pairs = useMemo(() => firstRoundPairs(order.map((p) => p.name)), [order]);

  // The big screen plays the same draw: each new draw (and each swap) is sent, with a number that restarts it there.
  useEffect(() => {
    void publishShow({ kind: "draw", key: round, title: summary ?? cup?.name ?? "Turnering", cup: cup ? { kind: cup.kind, name: cup.name, trophy: cup.trophy } : undefined, pairs });
  }, [round, order, pairs, summary, cup, seeded]);

  // Each draw shows its pairs one at a time. The pause is short: the point is that it is a draw, not that anyone waits.
  useEffect(() => {
    if (skipped === round || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setRevealed(pairs.length), 0);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    // A pair every 0.7 s for a small cup; a cup of 128 would take over a minute at that pace, so the whole draw is held to four seconds.
    const step = Math.min(700, 4000 / pairs.length);
    for (let i = 1; i <= pairs.length; i++) {
      timers.push(
        setTimeout(() => {
          setRevealed(i);
          drawSound(i / pairs.length, i === pairs.length);
        }, step * i),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [round, pairs.length, skipped]);

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

  const drawing = revealed < pairs.length;
  const now = revealed > 0 ? pairs[revealed - 1] : null;
  const colour = cupColor(cup?.kind);
  // The seeding follows the name in brackets, only in a seeded draw: «Lars (1)».
  const seedNo = (name: string): number | null => (mode === "seeded" ? order.findIndex((p) => p.name === name) + 1 : null);
  const slot = (name: string | null, shown: boolean) =>
    name ? (
      <button
        type="button"
        onClick={() => tap(name)}
        aria-pressed={picked !== null && order[picked].name === name}
        className={`flex-1 min-w-0 overflow-hidden flex items-center text-left px-3 rounded-lg ${FOCUS_RING}`}
        style={{
          minHeight: "var(--control)",
          background: picked !== null && order[picked].name === name ? "var(--teal-soft, color-mix(in srgb, var(--color-teal) 16%, transparent))" : "var(--color-cell)",
          border: picked !== null && order[picked].name === name ? "1px solid var(--color-teal)" : "1px solid transparent",
          color: "var(--color-cream)",
          opacity: shown ? 1 : 0,
          transform: shown ? "none" : "translateY(6px)",
          transition: "opacity var(--duration-base) var(--ease-standard), transform var(--duration-base) var(--ease-standard)",
        }}
      >
        <span className="min-w-0 truncate">
          {name}
          {seedNo(name) !== null && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}> ({seedNo(name)})</span>}
        </span>
      </button>
    ) : (
      <span className="flex-1 px-3 flex items-center" style={{ minHeight: "var(--control)", color: "var(--color-muted)", fontStyle: "italic", fontSize: "var(--text-small)", opacity: shown ? 1 : 0, transition: "opacity var(--duration-base) var(--ease-standard)" }}>
        Walkover
      </span>
    );

  return (
    <div className="animate-screen-push screen has-sticky-action cup-lamp" style={{ "--cup": colour } as React.CSSProperties}>
      <div className="screen-inner">
        <ScreenTop title="Trekning" onBack={onBack} backLabel="← Tilbake" />
        <StepStrip step={1} />
        {cup && <CupBanner cup={cup} />}
        {summary && (
          <button type="button" onClick={onBack} className={`tactile w-full rounded-lg px-4 flex items-center justify-between gap-3 mb-4 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: "var(--text-body)" }}>
            <span className="truncate">{summary}</span>
            <span style={{ color: "var(--color-teal)" }}>Endre</span>
          </button>
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
              style={{ minHeight: "var(--control)", background: mode === m ? "var(--teal-soft)" : "var(--color-surface)", color: mode === m ? "var(--color-teal)" : "var(--color-muted)", border: mode === m ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
            >
              {m === "seeded" ? "Seedet" : "Tilfeldig"}
            </button>
          ))}
        </div>
        {mode === "open" && (
          <p className="mb-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
            Trykk to navn for å bytte
          </p>
        )}
        {drawing && (
          <div
            className="draw-stage mb-4 text-center"
            style={{ "--draw": colour, borderRadius: "var(--radius-m)", background: `linear-gradient(180deg, color-mix(in srgb, ${colour} 16%, var(--color-surface)), var(--color-surface))`, border: `1px solid color-mix(in srgb, ${colour} 55%, var(--color-border))`, padding: "1rem" } as React.CSSProperties}
            aria-live="polite"
          >
            <div className="flex items-center justify-center gap-3" style={{ minHeight: "4.5rem" }}>
              {now ? (
                <div key={revealed} className="draw-stage-pair flex items-center justify-center gap-3 w-full">
                  <span aria-hidden className="draw-ball draw-pop">
                    {revealed}
                  </span>
                  <span className="draw-from-left font-display flex-1 min-w-0 truncate text-right" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                    {now.a ?? "Walkover"}
                  </span>
                  <span className="draw-pop font-display" style={{ color: colour }}>
                    mot
                  </span>
                  <span className="draw-from-right font-display flex-1 min-w-0 truncate text-left" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                    {now.b ?? "Walkover"}
                  </span>
                </div>
              ) : (
                <span className="draw-pulse" style={{ color: colour }}>
                  {cup ? <CupEmblem kind={cup.kind} className="w-12 h-12" /> : <TrophyIcon className="w-12 h-12" />}
                </span>
              )}
            </div>
            <div className="mt-3 rounded-full overflow-hidden" style={{ height: "0.3rem", background: "var(--color-cell)" }} aria-hidden>
              <div style={{ width: `${(revealed / pairs.length) * 100}%`, height: "100%", background: colour, transition: "width var(--pull)" }} />
            </div>
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" onClick={() => setSkipped(round)}>
                Hopp over
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-2 mb-4">
          {pairs.map((p, i) => (
            <div key={`${round}-${i}`} className={`flex items-center gap-2 rounded-xl p-2 ${i === revealed - 1 && drawing ? "draw-flash" : ""}`} style={{ "--draw": colour, background: "var(--color-panel)", border: "1px solid var(--color-border)" } as React.CSSProperties}>
              {slot(p.a, i < revealed)}
              <span className="font-display" style={{ color: "var(--color-muted)", opacity: i < revealed ? 1 : 0 }}>
                mot
              </span>
              {slot(p.b, i < revealed)}
            </div>
          ))}
        </div>
        {!drawing && (
          <div className="mb-4">
            <MiniBracket pairs={pairs} accent={colour} seedOf={seedNo} />
          </div>
        )}
        {mode === "open" && (
          <div className="flex justify-center mb-4">
            <button type="button" onClick={again} className={`tactile px-4 rounded-lg text-sm ${FOCUS_RING}`} style={{ minHeight: "var(--control)", color: "var(--color-cream)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              Trekk på nytt
            </button>
          </div>
        )}
        <StickyAction onClick={() => onStart(order)} ready reason={null}>
          Start
        </StickyAction>
      </div>
    </div>
  );
}
