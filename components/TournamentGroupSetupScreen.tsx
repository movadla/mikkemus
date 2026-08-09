"use client";

import { useState } from "react";
import { distributeEvenly, suggestGroups, type TournamentMode } from "@/lib/tournament";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 1);
}

/** Same "how many advance per group" rule buildPlayoffBracket uses — kept in sync here purely for
 *  the live summary line, not for actually generating matches. */
function describeSetup(groups: string[][], matchSize: number): string {
  const podNote = matchSize > 2 ? ` Hver gruppe spilles i puljer på ${matchSize} sammen på delt brett.` : "";
  if (groups.length <= 1) return `Ingen sluttspill — vinneren av tabellen blir turneringsvinner.${podNote}`;
  const minSize = Math.min(...groups.map((g) => g.length));
  const advancePerGroup = Math.min(2, minSize);
  const advancers = groups.length * advancePerGroup;
  const bracketSize = nextPowerOfTwo(advancers);
  const byes = bracketSize - advancers;
  const byeNote = byes > 0 ? ` (${byes} får walkover første runde)` : "";
  return `${groups.length} grupper → sluttspill med topp ${advancePerGroup} fra hver (${advancers} deltakere)${byeNote}.${podNote}`;
}

export function TournamentGroupSetupScreen({
  participantNames,
  mode,
  onBack,
  onGenerate,
}: {
  participantNames: string[];
  mode: TournamentMode;
  onBack: () => void;
  onGenerate: (groups: string[][], matchSize: number) => void;
}) {
  const [matchSize, setMatchSize] = useState(2);
  const [groups, setGroups] = useState<string[][]>(() => suggestGroups(participantNames));

  const maxGroups = Math.max(1, Math.floor(participantNames.length / matchSize));

  function setGroupCount(count: number) {
    const clamped = Math.min(maxGroups, Math.max(1, count));
    setGroups(distributeEvenly(participantNames, clamped));
  }

  function changeMatchSize(size: number) {
    setMatchSize(size);
    // Minimum group size depends on matchSize, so whatever's on screen might no longer be valid —
    // simplest correct move is to re-suggest from scratch, same as picking a fresh mode would.
    setGroups(suggestGroups(participantNames));
  }

  function moveToGroup(name: string, groupIndex: number) {
    setGroups((prev) => prev.map((g, i) => (i === groupIndex ? [...g.filter((n) => n !== name), name] : g.filter((n) => n !== name))));
  }

  return (
    <div className="animate-screen-enter min-h-screen w-full flex items-center justify-center p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <button type="button" onClick={onBack} className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}>
            ← Tilbake
          </button>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.3rem" }}>
            Juster grupper
          </h1>
          <div style={{ width: "72px" }} />
        </div>

        {mode === "individual" && (
          <>
            <p className="mb-2 text-center" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              HVOR MANGE SPILLER SAMTIDIG?
            </p>
            <div className="flex gap-3 mb-6">
              {[2, 3].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => changeMatchSize(size)}
                  className={`tactile flex-1 py-2.5 rounded-lg font-medium ${FOCUS_RING}`}
                  style={{
                    background: matchSize === size ? "var(--color-teal)" : "var(--color-surface)",
                    color: matchSize === size ? "var(--color-bg)" : "var(--color-cream)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            type="button"
            onClick={() => setGroupCount(groups.length - 1)}
            disabled={groups.length <= 1}
            className={`tactile w-10 h-10 rounded-full text-lg font-semibold ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", color: "var(--color-cream)", opacity: groups.length <= 1 ? 0.4 : 1 }}
          >
            −
          </button>
          <span className="tabular" style={{ color: "var(--color-cream)", fontSize: "1.1rem", minWidth: "7rem", textAlign: "center" }}>
            {groups.length} {groups.length === 1 ? "gruppe" : "grupper"}
          </span>
          <button
            type="button"
            onClick={() => setGroupCount(groups.length + 1)}
            disabled={groups.length >= maxGroups}
            className={`tactile w-10 h-10 rounded-full text-lg font-semibold ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", color: "var(--color-cream)", opacity: groups.length >= maxGroups ? 0.4 : 1 }}
          >
            +
          </button>
        </div>

        <p className="text-center mb-6" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
          {describeSetup(groups, matchSize)}
        </p>

        <div className="space-y-3 mb-6">
          {groups.map((group, gi) => (
            <div key={gi} className="shadow-panel rounded-xl p-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
              <p className="mb-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
                GRUPPE {gi + 1}
              </p>
              <div className="space-y-1.5">
                {group.map((name) => (
                  <div key={name} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: "var(--color-surface)" }}>
                    <span style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>{name}</span>
                    {groups.length > 1 && (
                      <select
                        value={gi}
                        onChange={(e) => moveToGroup(name, Number(e.target.value))}
                        className={`text-xs px-2 py-1 rounded ${FOCUS_RING}`}
                        style={{ background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                      >
                        {groups.map((_, i) => (
                          <option key={i} value={i}>
                            Gruppe {i + 1}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
                {group.length === 0 && (
                  <p className="text-center py-1" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
                    Tom gruppe
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={groups.some((g) => g.length < matchSize)}
          onClick={() => onGenerate(groups, matchSize)}
          className={`tactile w-full py-4 rounded-lg font-semibold text-lg transition-opacity ${FOCUS_RING}`}
          style={{ background: "var(--color-green)", color: "var(--color-cream)", opacity: groups.some((g) => g.length < matchSize) ? 0.4 : 1 }}
        >
          Generer turnering
        </button>
        {groups.some((g) => g.length < matchSize) && (
          <p className="text-center mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
            Hver gruppe trenger minst {matchSize} deltakere
          </p>
        )}
      </div>
    </div>
  );
}
