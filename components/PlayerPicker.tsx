"use client";

import { useMemo, useState } from "react";
import { useRoster } from "@/lib/storage";
import { BOT_LEVEL_PICKABLE, botDisplayName, type BotLevel } from "@/lib/botLevels";
import { nextBotName, sameName, type Person } from "@/lib/people";
import { filterNames, readUsage, sortByRecent } from "@/lib/recentPlayers";
import { BotIcon, CloseIcon, GuestIcon } from "./icons";
import { LevelBadge } from "./LevelBadge";
import { Avatar } from "./ui/Avatar";
import { SearchField, TextField } from "./ui/TextField";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** A search box only earns its place once the list is long enough to need one. */
const SEARCH_FROM = 12;

const addButton = "tactile flex-1 rounded-lg text-sm font-medium flex items-center justify-center gap-2";

/**
 * Who is in: one list of everyone known, as tiles in two columns, where a tap puts someone in the
 * match and shows their place in the order; a tap again takes them out. The people from last time
 * come first. New names, guests and bots join the same list at the end, so there is one list to
 * read, not a list to pick from and a second one showing what was picked.
 *
 * A new name is only a name here — it is saved as a player when the match starts (see the setup
 * screens), so a slip of the finger does not become a row in the database.
 */
export function PlayerPicker({
  people,
  onChange,
  botsAllowed = true,
  guests = false,
  hidden = [],
  bulk = false,
}: {
  people: Person[];
  onChange: (people: Person[]) => void;
  /** False for the longer games, where the bot's model is too heavy to build — see botsSupported. */
  botsAllowed?: boolean;
  /** Whether a guest — someone who plays but is never saved — can be added. */
  guests?: boolean;
  /** Names not offered — people already on another team. */
  hidden?: string[];
  /** Offers everyone at once, and nobody. */
  bulk?: boolean;
}) {
  const [adding, setAdding] = useState<"player" | "guest" | "bot" | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const roster = useRoster();

  const known = useMemo(() => {
    const names = roster.filter((r) => r.kind !== "team" && !hidden.some((h) => sameName(h, r.name))).map((r) => r.name);
    return sortByRecent(names, readUsage());
  }, [roster, hidden]);
  const extra = people.filter((p) => !known.some((n) => sameName(n, p.name)));
  const shown = [...filterNames(known, query).map((name) => people.find((p) => sameName(p.name, name)) ?? { name, isBot: false }), ...extra];

  function orderOf(name: string): number {
    return people.findIndex((p) => sameName(p.name, name));
  }

  function toggle(person: Person) {
    const i = orderOf(person.name);
    onChange(i === -1 ? [...people, person] : people.filter((_, j) => j !== i));
  }

  function addName(isGuest: boolean) {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    if (orderOf(trimmed) !== -1) {
      setError(`«${trimmed}» er allerede med`);
      return;
    }
    // A known name typed again is that player, in the spelling they already have.
    const existing = known.find((n) => sameName(n, trimmed));
    onChange([...people, existing ? { name: existing, isBot: false } : { name: trimmed, isBot: false, ...(isGuest ? { isGuest: true } : {}) }]);
    setNameInput("");
    setError("");
    setAdding(null);
  }

  function addBot(level: BotLevel) {
    onChange([...people, { name: nextBotName(level, people.map((p) => p.name)), isBot: true, botLevel: level }]);
    setAdding(null);
  }

  function open(kind: "player" | "guest" | "bot") {
    setAdding((cur) => (cur === kind ? null : kind));
    setNameInput("");
    setError("");
  }

  return (
    <div className="mb-4">
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => open("player")}
          aria-expanded={adding === "player"}
          className={`${addButton} ${FOCUS_RING}`}
          style={{ minHeight: "var(--control)", background: "var(--color-surface)", border: "1.5px dashed var(--color-teal)", color: "var(--color-teal)" }}
        >
          <span aria-hidden style={{ fontSize: "var(--text-body)", lineHeight: 1, fontWeight: 700 }}>
            +
          </span>
          Ny spiller
        </button>
        {guests && (
          <button
            type="button"
            onClick={() => open("guest")}
            aria-expanded={adding === "guest"}
            className={`${addButton} ${FOCUS_RING}`}
            style={{ minHeight: "var(--control)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
          >
            <GuestIcon className="w-3.5 h-3.5" />
            Gjest
          </button>
        )}
        <button
          type="button"
          onClick={() => open("bot")}
          disabled={!botsAllowed}
          aria-expanded={adding === "bot"}
          className={`${addButton} ${FOCUS_RING}`}
          style={{ minHeight: "var(--control)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", opacity: botsAllowed ? 1 : 0.4 }}
        >
          <BotIcon className="w-4 h-4" />
          Bot
        </button>
      </div>

      {(adding === "player" || adding === "guest") && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1 min-w-0">
            <TextField
              autoFocus
              hideLabel
              value={nameInput}
              onChange={(v) => {
                setNameInput(v);
                setError("");
              }}
              onEnter={() => addName(adding === "guest")}
              placeholder={adding === "guest" ? "Gjestens navn" : "Spillernavn"}
              label={adding === "guest" ? "Gjestens navn" : "Spillernavn"}
            />
          </div>
          <button
            type="button"
            onClick={() => addName(adding === "guest")}
            className={`glossy px-4 rounded-lg font-medium ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control)" } as React.CSSProperties}
          >
            Legg til
          </button>
          <button
            type="button"
            onClick={() => setAdding(null)}
            aria-label="Avbryt"
            className={`tactile rounded-lg flex items-center justify-center shrink-0 ${FOCUS_RING}`}
            style={{ width: "2.75rem", minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      {adding === "bot" && botsAllowed && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {BOT_LEVEL_PICKABLE.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => addBot(level)}
              className={`tactile rounded-lg text-sm px-2 inline-flex items-center justify-center gap-1 ${FOCUS_RING}`}
              style={{ minHeight: "var(--control)", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
            >
              {botDisplayName(level)}
              <LevelBadge level={level} />
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-center mb-4" style={{ color: "var(--color-red)", fontSize: "var(--text-micro)" }}>
          {error}
        </p>
      )}

      {known.length >= SEARCH_FROM && (
        <div className="mb-4">
          <SearchField value={query} onChange={setQuery} label="Søk etter spiller" />
        </div>
      )}

      {bulk && known.length > 0 && (
        <div className="flex justify-end gap-2 mb-2">
          {([
            ["Alle", () => onChange([...people, ...filterNames(known, query).filter((n) => orderOf(n) === -1).map((name) => ({ name, isBot: false }))])],
            ["Ingen", () => onChange([])],
          ] as const).map(([label, run]) => (
            <button key={label} type="button" onClick={run} className={`tactile rounded-lg px-3 text-sm ${FOCUS_RING}`} style={{ minHeight: "2.25rem", background: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Spillere">
          {shown.map((person) => {
            const order = orderOf(person.name);
            const selected = order !== -1;
            const photo = roster.find((r) => sameName(r.name, person.name))?.photo;
            const botBlocked = person.isBot && !botsAllowed;
            const dashed = person.isBot || person.isGuest;
            return (
              <button
                key={person.name}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(person)}
                className={`tactile flex items-center gap-2 pl-2 pr-2 rounded-lg text-left ${FOCUS_RING}`}
                style={{
                  minHeight: "var(--control)",
                  background: selected ? "var(--teal-soft)" : "var(--color-surface)",
                  border: selected ? "1px solid var(--color-teal)" : `1px ${dashed ? "dashed" : "solid"} var(--color-border)`,
                }}
              >
                {person.isGuest ? (
                  <span aria-hidden className="rounded-full shrink-0 flex items-center justify-center" style={{ width: 32, height: 32, background: "var(--color-cell)", border: "1.5px dashed var(--color-border)" }}>
                    <GuestIcon className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <Avatar name={person.name} photo={photo} size="s" bot={person.isBot} />
                )}
                <span className="flex-1 min-w-0 truncate" style={{ color: botBlocked ? "var(--color-red)" : selected ? "var(--color-cream)" : "var(--color-muted)", fontSize: "var(--text-body)", fontWeight: selected ? 600 : 400 }}>
                  {person.name}
                  {person.isGuest && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", fontWeight: 400 }}> · gjest</span>}
                </span>
                {selected && (
                  <span
                    className="tabular rounded-full shrink-0 flex items-center justify-center"
                    style={{ width: "1.375rem", height: "1.375rem", background: "var(--color-teal)", color: "var(--color-bg)", fontSize: "var(--text-micro)", fontWeight: 700 }}
                    aria-label={`nummer ${order + 1}`}
                  >
                    {order + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {shown.length === 0 && query && (
        <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Ingen spillere heter noe slikt.</p>
      )}
    </div>
  );
}
