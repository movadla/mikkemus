"use client";

import { useState } from "react";
import { distributeEvenly, suggestGroups } from "@/lib/tournament";
import { ScreenTop } from "./ScreenTop";
import { StickyAction } from "./StickyAction";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 1);
}

/** One line under the counter: how many groups, and what that means for the playoff. Same
 *  "how many advance per group" rule buildPlayoffBracket uses — kept in sync here purely for
 *  the summary, not for actually generating matches. */
function describeSetup(groups: string[][]): string {
  if (groups.length <= 1) return "1 gruppe · ingen sluttspill";
  const minSize = Math.min(...groups.map((g) => g.length));
  const advancePerGroup = Math.min(2, minSize);
  const advancers = groups.length * advancePerGroup;
  const byes = nextPowerOfTwo(advancers) - advancers;
  return `${groups.length} grupper · sluttspill med ${advancers}${byes > 0 ? ` · ${byes} walkover` : ""}`;
}

/** Every match is one against one. Tournaments from before this was fixed may still hold pods of
 *  three or more (see lib/tournament.ts) and keep working, but nothing creates them any more. */
const MATCH_SIZE = 2;

export function TournamentGroupSetupScreen({
  participantNames,
  onBack,
  onGenerate,
  submitting = false,
}: {
  participantNames: string[];
  onBack: () => void;
  onGenerate: (groups: string[][], matchSize: number) => void;
  /** True while a previous tap is still saving — disables the button so a double-tap can't
   *  fire a second write while the first is in flight. */
  submitting?: boolean;
}) {
  const [groups, setGroups] = useState<string[][]>(() => suggestGroups(participantNames));

  const maxGroups = Math.max(1, Math.floor(participantNames.length / MATCH_SIZE));

  function setGroupCount(count: number) {
    const clamped = Math.min(maxGroups, Math.max(1, count));
    setGroups(distributeEvenly(participantNames, clamped));
  }

  function moveToGroup(name: string, groupIndex: number) {
    setGroups((prev) => prev.map((g, i) => (i === groupIndex ? [...g.filter((n) => n !== name), name] : g.filter((n) => n !== name))));
  }

  const tooSmall = groups.findIndex((g) => g.length < MATCH_SIZE);
  const stepper = (label: string, onClick: () => void, disabled: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label === "−" ? "Færre grupper" : "Flere grupper"}
      className={`tactile rounded-full text-xl font-semibold ${FOCUS_RING}`}
      style={{ width: "2.75rem", height: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", opacity: disabled ? 0.4 : 1 }}
    >
      {label}
    </button>
  );

  return (
    <div className="animate-screen-enter screen has-sticky-action" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Grupper" onBack={onBack} backLabel="← Tilbake" />

        <div className="flex items-center justify-center gap-4 mb-2">
          {stepper("−", () => setGroupCount(groups.length - 1), groups.length <= 1)}
          <span className="tabular" style={{ color: "var(--color-cream)", fontSize: "1.1rem", minWidth: "7rem", textAlign: "center" }}>
            {groups.length} {groups.length === 1 ? "gruppe" : "grupper"}
          </span>
          {stepper("+", () => setGroupCount(groups.length + 1), groups.length >= maxGroups)}
        </div>

        <p className="text-center mb-6 tabular" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
          {describeSetup(groups)}
        </p>

        <div className="space-y-4">
          {groups.map((group, gi) => (
            <div key={gi} className="shadow-panel rounded-xl p-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
              <p className="mb-2 section-label">GRUPPE {gi + 1}</p>
              <div className="space-y-2">
                {group.map((name) => (
                  <div key={name} className="flex items-center justify-between gap-2 pl-4 pr-2 rounded-lg" style={{ background: "var(--color-surface)", minHeight: "2.75rem" }}>
                    <span style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>{name}</span>
                    {groups.length > 1 && (
                      <select
                        value={gi}
                        onChange={(e) => moveToGroup(name, Number(e.target.value))}
                        aria-label={`Gruppe for ${name}`}
                        className={`text-sm px-2 rounded ${FOCUS_RING}`}
                        style={{ minHeight: "2.25rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                      >
                        {groups.map((_, i) => (
                          <option key={i} value={i} style={{ background: "var(--color-cell)", color: "var(--color-cream)" }}>
                            Gruppe {i + 1}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
                {group.length === 0 && (
                  <p className="text-center py-2" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
                    Tom gruppe
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <StickyAction
          onClick={() => onGenerate(groups, MATCH_SIZE)}
          ready={tooSmall === -1 && !submitting}
          summary={describeSetup(groups)}
          reason={tooSmall === -1 ? undefined : `Gruppe ${tooSmall + 1} trenger ${MATCH_SIZE} deltakere`}
        >
          {submitting ? "Oppretter …" : "Opprett turnering"}
        </StickyAction>
      </div>
    </div>
  );
}
