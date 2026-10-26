"use client";

import { Fragment, useState } from "react";
import { STEPS, STEP_LABELS, type Step } from "@/lib/game";
import { getRules } from "@/lib/rules";
import { avatarAccent } from "@/lib/avatarAccent";
import type { Kit } from "@/lib/teamKit";
import { ConfirmDialog } from "./ConfirmDialog";
import { FxMenu } from "./FxMenu";
import { Mark } from "./Mark";
import { TeamKit } from "./TeamKit";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type Tap = { player: string; step: Step };

/**
 * «Enkel»: the board as a chalkboard in a pub. Only the names and the rows — a tap on any box puts a cross there, whoever's
 * turn it is, with nothing to confirm and nothing to say who threw. Angre takes the last cross off. It keeps no turns, no darts
 * and no statistics, and nothing it holds is written anywhere: it is there to keep the score of the match, and that is all.
 */
export function ChalkboardScreen({ players, kits, onExit }: { players: string[]; kits: Record<string, Kit>; onExit: () => void }) {
  const target = getRules().target;
  const [taps, setTaps] = useState<Tap[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);

  const board: Record<string, Partial<Record<Step, number>>> = {};
  for (const p of players) board[p] = {};
  for (const t of taps) board[t.player][t.step] = (board[t.player][t.step] ?? 0) + 1;

  const closedAll = (p: string) => STEPS.every((s) => (board[p]?.[s] ?? 0) >= target);
  const done = players.filter(closedAll);

  function tap(player: string, step: Step) {
    if ((board[player][step] ?? 0) >= target) return;
    setTaps((prev) => [...prev, { player, step }]);
  }

  return (
    <div className="game-root animate-screen-enter relative w-full flex flex-col p-4" style={{ height: "100dvh", background: "var(--color-bg)" }}>
      <div className="flex items-center gap-2 mb-2 max-w-3xl mx-auto w-full shrink-0">
        <button
          type="button"
          onClick={() => setConfirmExit(true)}
          className={`tactile rounded-lg text-sm px-3 py-2 ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
        >
          ← Hjem
        </button>
        <p className="flex-1 text-center" style={{ color: "var(--color-red)", fontSize: "var(--text-micro)", letterSpacing: "0.06em" }}>
          ENKEL: TELLER IKKE I STATISTIKKEN
        </p>
        {/* The way back: Enkel is a level like the others, and it can be left from here. */}
        <button
          type="button"
          onClick={() => setFxOpen(true)}
          className={`tactile rounded-lg text-sm px-3 py-2 ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
        >
          Bytt modus
        </button>
      </div>

      {done.length > 0 && (
        <p
          role="status"
          className="max-w-3xl mx-auto w-full mb-2 px-3 py-2 rounded-lg text-center shrink-0"
          style={{ background: "var(--gold-soft)", border: "1px solid var(--color-gold)", color: "var(--color-gold-strong)", fontWeight: 700 }}
        >
          {done.join(" og ")} har lukket alt
        </p>
      )}

      <div className="relative flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden shadow-panel max-w-3xl mx-auto w-full" style={{ background: "var(--color-panel)" }}>
        <div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-auto">
          <div
            className="game-grid grid h-full"
            style={{
              gridTemplateColumns: `64px repeat(${players.length}, minmax(64px, 11rem))`,
              justifyContent: "center",
              gridTemplateRows: `auto repeat(${STEPS.length}, minmax(var(--row-min, 2.4rem), 1fr))`,
            }}
          >
            <div className="sticky left-0 z-10" style={{ background: "var(--color-panel)" }} />
            {players.map((p) => (
              <div key={p} className="player-head flex flex-col items-center justify-center gap-1.5 p-2 pb-2.5 text-center grid-rule-left" style={{ borderBottom: "2px solid var(--color-border)" }}>
                <span className="block max-w-full truncate px-3 py-0.5 rounded-full" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)", fontWeight: 600, background: "var(--veil)" }}>
                  {kits[p] && (
                    <span className="inline-block align-middle mr-1" style={{ marginTop: "-2px" }}>
                      <TeamKit kit={kits[p]} size={18} />
                    </span>
                  )}
                  {p}
                </span>
                <span aria-hidden className="block rounded-full" style={{ width: "26px", height: "3px", background: avatarAccent(p) }} />
              </div>
            ))}

            {STEPS.map((s) => {
              const isNumber = !Number.isNaN(Number(s));
              return (
                <Fragment key={s}>
                  <div
                    className="grid-rule-top sticky left-0 z-10 flex items-center justify-center tabular"
                    style={{
                      color: "var(--color-cream)",
                      fontFamily: isNumber ? "var(--font-display)" : "var(--font-sans)",
                      fontSize: isNumber ? "var(--text-title)" : "var(--text-body)",
                      fontWeight: isNumber ? 600 : 700,
                      background: "var(--color-panel)",
                    }}
                  >
                    {STEP_LABELS[s]}
                  </div>
                  {players.map((p) => {
                    const count = board[p][s] ?? 0;
                    return (
                      <div key={p} className="cell-wrap relative min-h-0 min-w-0 flex items-center justify-center p-0.5 grid-rule-top grid-rule-left">
                        <button
                          type="button"
                          onClick={() => tap(p, s)}
                          aria-label={`${p}, ${STEP_LABELS[s]}: ${count} av ${target}`}
                          className={`cell-tile cell-tile--open ${count >= target ? "cell-tile--done" : ""} relative w-full h-full min-h-0 min-w-0 max-w-full max-h-full rounded-md flex items-center justify-center ${FOCUS_RING}`}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="mark-pad w-full h-full">
                            <Mark count={count} />
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="action-bar shrink-0 mt-3 -mx-4 px-4 pt-2 pb-1">
        <div className="max-w-3xl mx-auto w-full">
          <button
            type="button"
            onClick={() => setTaps((prev) => prev.slice(0, -1))}
            disabled={taps.length === 0}
            className={`glossy w-full py-4 rounded-xl font-semibold text-lg transition-opacity ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", opacity: taps.length === 0 ? 0.4 : 1 } as React.CSSProperties}
          >
            Angre
          </button>
        </div>
      </div>

      {fxOpen && <FxMenu onClose={() => setFxOpen(false)} />}
      {confirmExit && (
        <ConfirmDialog
          message="Avslutte kampen? Stillingen forsvinner, og ingenting lagres."
          buttons={[
            { label: "Fortsett spill", onClick: () => setConfirmExit(false), background: "var(--color-green)" },
            { label: "Avslutt kamp", onClick: onExit, background: "var(--color-red)" },
          ]}
        />
      )}
    </div>
  );
}
