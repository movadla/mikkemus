"use client";

import { useState } from "react";
import { ensurePlayer, useRosterNames } from "@/lib/storage";
import { BOT_LEVEL_ORDER, BOT_LEVELS, type BotLevel } from "@/lib/botLevels";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

export type Person = { name: string; isBot: boolean; botLevel?: BotLevel };

/** Shared "add people (real or bot) to a pool" picker — used both for a plain roster of
 *  participants and as the source pool teams are built from (see TeamComposer). Controlled:
 *  the parent owns `people` and decides what removing someone should also affect (e.g. also
 *  unassigning them from a team) via `onChange`. */
export function PeoplePicker({ people, onChange }: { people: Person[]; onChange: (people: Person[]) => void }) {
  const [nameInput, setNameInput] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [error, setError] = useState("");
  const rosterNames = useRosterNames();

  const availableRoster = rosterNames.filter((n) => !people.some((p) => p.name.toLowerCase() === n.toLowerCase()));

  function addPerson(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (people.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" er allerede lagt til`);
      return;
    }
    ensurePlayer(trimmed);
    onChange([...people, { name: trimmed, isBot: false }]);
    setNameInput("");
    setError("");
    setAddingPlayer(false);
  }

  function addBot(level: BotLevel) {
    const base = `🤖 ${BOT_LEVELS[level].name} (${level})`;
    let name = base;
    let suffix = 2;
    while (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      name = `${base} (${suffix})`;
      suffix++;
    }
    onChange([...people, { name, isBot: true, botLevel: level }]);
    setShowBotPicker(false);
  }

  function removePerson(name: string) {
    onChange(people.filter((p) => p.name !== name));
  }

  return (
    <>
      {availableRoster.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {availableRoster.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => addPerson(n)}
              className={`tactile px-3 py-1.5 rounded-full text-sm ${FOCUS_RING}`}
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4">
        {addingPlayer ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && addPerson(nameInput)}
              placeholder="Spillernavn"
              className={`flex-1 px-4 py-2.5 rounded-lg ${FOCUS_RING}`}
              style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
            />
            <button type="button" onClick={() => addPerson(nameInput)} className={`tactile px-4 py-2.5 rounded-lg font-medium ${FOCUS_RING}`} style={{ background: "var(--color-teal)", color: "var(--color-bg)" }}>
              Legg til
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setAddingPlayer(true)} className={`tactile px-4 py-1.5 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-teal)", border: "1px solid var(--color-border)" }}>
              Legg til spiller
            </button>
            <button type="button" onClick={() => setShowBotPicker((v) => !v)} className={`tactile px-4 py-1.5 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-gold)", border: "1px solid var(--color-border)" }}>
              🤖 Legg til bot
            </button>
          </div>
        )}
        {showBotPicker && (
          <div className="flex flex-wrap gap-2 mt-3">
            {BOT_LEVEL_ORDER.map((level) => (
              <button key={level} type="button" onClick={() => addBot(level)} className={`tactile px-3 py-1.5 rounded-full text-sm ${FOCUS_RING}`} style={{ background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
                {BOT_LEVELS[level].name} ({level})
              </button>
            ))}
          </div>
        )}
        {error && (
          <p className="text-sm mt-2" style={{ color: "var(--color-red)" }}>
            {error}
          </p>
        )}
      </div>

      <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
        <div className="space-y-2 min-h-[48px]">
          {people.length === 0 && (
            <p className="text-center py-2" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
              Ingen deltakere lagt til enda
            </p>
          )}
          {people.map((p, i) => (
            <div key={p.name} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--color-surface)" }}>
              <span style={{ color: "var(--color-cream)" }}>
                <span style={{ color: "var(--color-teal)", marginRight: "0.5rem" }}>{i + 1}.</span>
                {p.name}
              </span>
              <button type="button" onClick={() => removePerson(p.name)} className={`text-sm px-2 ${FOCUS_RING}`} style={{ color: "var(--color-red)" }}>
                Fjern
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
