"use client";

import { useMemo, useState } from "react";
import { useRoster } from "@/lib/storage";
import { BOT_LEVEL_PICKABLE, botDisplayName, type BotLevel } from "@/lib/botLevels";
import { nextBotName, sameName, type Person } from "@/lib/people";
import { readUsage, sortByRecent } from "@/lib/recentPlayers";
import { BotIcon, CloseIcon, GuestIcon } from "./icons";
import { LevelBadge } from "./LevelBadge";
import { Avatar } from "./ui/Avatar";
import { TextField } from "./ui/TextField";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** The look of the three buttons that add someone: framed and tinted in the accent. */
const ACTION: React.CSSProperties = { minHeight: "var(--control)", color: "var(--color-teal)", fontWeight: 700, fontSize: "var(--text-small)", background: "color-mix(in srgb, var(--color-teal) 7%, transparent)", border: "1px solid color-mix(in srgb, var(--color-teal) 45%, var(--color-border))" };

/** How many of the known players are shown before "Flere spillere": the ones with the most matches. */
const SHOWN = 6;

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
}: {
  people: Person[];
  onChange: (people: Person[]) => void;
  /** False for the longer games, where the bot's model is too heavy to build — see botsSupported. */
  botsAllowed?: boolean;
  /** Whether a guest — someone who plays but is never saved — can be added. */
  guests?: boolean;
  /** Names not offered — people already on another team. */
  hidden?: string[];
}) {
  const [adding, setAdding] = useState<"player" | "guest" | "bot" | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const roster = useRoster();

  const known = useMemo(() => {
    const names = roster.filter((r) => r.kind !== "team" && !hidden.some((h) => sameName(h, r.name))).map((r) => r.name);
    return sortByRecent(names, readUsage());
  }, [roster, hidden]);
  const extra = people.filter((p) => !known.some((n) => sameName(n, p.name)));
  // The ones who are in are a row of their own at the top; the list under it holds the rest: the six with the most matches, and the others behind one button.
  const unpicked = known.filter((n) => !people.some((p) => sameName(p.name, n)));
  const top = useMemo(() => new Set([...unpicked].sort((a, b) => (roster.find((r) => sameName(r.name, b))?.matchesPlayed ?? 0) - (roster.find((r) => sameName(r.name, a))?.matchesPlayed ?? 0) || known.indexOf(a) - known.indexOf(b)).slice(0, SHOWN)), [unpicked, known, roster]);
  const listed = unpicked.filter((n) => more || top.has(n));
  const hiddenCount = unpicked.length - listed.length;
  // Under the field for a new name: the players who are known already with that spelling, so a name that is there is tapped, not typed again.
  const typed = nameInput.trim();
  const suggestions = adding === "player" && typed ? [...known, ...extra.filter((p) => !p.isBot && !p.isGuest).map((p) => p.name)].filter((n) => n.toLowerCase().includes(typed.toLowerCase())).slice(0, 5) : [];
  const shown: Person[] = listed.map((name) => ({ name, isBot: false }));


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
      {people.length > 0 && (
        <div className="mb-3" role="group" aria-label="Med">
          <p className="section-label mb-1.5">MED ({people.length})</p>
          <ul className="flex flex-wrap gap-x-2 gap-y-2.5">
            {people.map((person, i) => {
              const photo = roster.find((r) => sameName(r.name, person.name))?.photo;
              const botBlocked = person.isBot && !botsAllowed;
              return (
                <li key={person.name}>
                  <button type="button" onClick={() => toggle(person)} aria-label={`Ta ut ${person.name}, nummer ${i + 1}`} className={`tactile flat relative flex flex-col items-center gap-0.5 ${FOCUS_RING}`} style={{ width: "3.6rem" }}>
                    <span className="relative">
                      {person.isGuest ? (
                        <span aria-hidden className="rounded-full flex items-center justify-center" style={{ width: 40, height: 40, background: "var(--color-cell)", border: "1.5px dashed var(--color-border)" }}>
                          <GuestIcon className="w-4 h-4" />
                        </span>
                      ) : (
                        <Avatar name={person.name} photo={photo} px={40} bot={person.isBot} state="active" />
                      )}
                      <span aria-hidden className="tabular rounded-full flex items-center justify-center absolute" style={{ top: -4, right: -6, width: "1.1rem", height: "1.1rem", background: "var(--color-teal)", color: "var(--color-bg)", fontSize: "0.75rem", fontWeight: 700 }}>
                        {i + 1}
                      </span>
                    </span>
                    <span className="w-full truncate text-center" style={{ color: botBlocked ? "var(--color-red)" : "var(--color-cream)", fontSize: "var(--text-micro)", fontWeight: 600 }}>
                      {person.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* The ones who can be picked are small name tags with a plus, not boxes: a person is one kind of thing, an action another. */}
      {(shown.length > 0 || hiddenCount > 0) && (
        <ul className="grid grid-cols-3 gap-2" role="group" aria-label="Spillere">
          {shown.map((person) => {
            const photo = roster.find((r) => sameName(r.name, person.name))?.photo;
            return (
              <li key={person.name} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={false}
                  onClick={() => toggle(person)}
                  className={`tactile flat flex w-full items-center gap-1.5 rounded-lg pl-1.5 pr-2 ${FOCUS_RING}`}
                  style={{ minHeight: "2.6rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: "var(--text-small)" }}
                >
                  <Avatar name={person.name} photo={photo} px={26} />
                  <span className="min-w-0 truncate">{person.name}</span>
                </button>
              </li>
            );
          })}
          {(hiddenCount > 0 || more) && known.length > SHOWN && (
            <li className="min-w-0 col-span-full">
              <button
                type="button"
                onClick={() => setMore((m) => !m)}
                aria-expanded={more}
                aria-label={more ? "Færre spillere" : `Flere spillere (${hiddenCount})`}
                className={`tactile flat flex w-full items-center justify-center rounded-lg px-2 ${FOCUS_RING}`}
                style={{ minHeight: "2.6rem", background: "transparent", border: "1px dashed var(--color-teal)", color: "var(--color-teal)", fontSize: "var(--text-small)", fontWeight: 700 }}
              >
                {more ? "Færre" : `+ ${hiddenCount} flere`}
              </button>
            </li>
          )}
        </ul>
      )}
      <div className="mt-4">
      {/* What you do, not who you pick: three framed buttons of equal width, tinted in the accent, so they read as actions and not as players. */}
      <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${guests ? 3 : 2}, minmax(0, 1fr))` }}>
        <button type="button" onClick={() => open("player")} aria-expanded={adding === "player"} className={`tactile flat flex items-center justify-center gap-1.5 rounded-lg ${FOCUS_RING}`} style={ACTION}>
          <span aria-hidden style={{ fontSize: "1.1em", lineHeight: 1 }}>+</span>
          Ny spiller
        </button>
        {guests && (
          <button type="button" onClick={() => open("guest")} aria-expanded={adding === "guest"} className={`tactile flat flex items-center justify-center gap-1.5 rounded-lg ${FOCUS_RING}`} style={ACTION}>
            <GuestIcon className="w-3.5 h-3.5" />
            Gjest
          </button>
        )}
        <button type="button" onClick={() => open("bot")} disabled={!botsAllowed} aria-expanded={adding === "bot"} className={`tactile flat flex items-center justify-center gap-1.5 rounded-lg ${FOCUS_RING}`} style={{ ...ACTION, opacity: botsAllowed ? 1 : 0.4 }}>
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
      {suggestions.length > 0 && (
        <ul className="mb-4 rounded-lg overflow-hidden" aria-label="Spillere som finnes" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          {suggestions.map((name) => {
            const inAlready = orderOf(name) !== -1;
            const photo = roster.find((r) => sameName(r.name, name))?.photo;
            return (
              <li key={name} style={{ borderTop: "1px solid var(--color-border)" }} className="first:border-t-0">
                <button
                  type="button"
                  disabled={inAlready}
                  onClick={() => {
                    onChange([...people, { name, isBot: false }]);
                    setNameInput("");
                    setError("");
                    setAdding(null);
                  }}
                  className={`tactile flat w-full flex items-center gap-2 px-3 text-left ${FOCUS_RING}`}
                  style={{ minHeight: "var(--control)", color: "var(--color-cream)", opacity: inAlready ? 0.6 : 1 }}
                >
                  <Avatar name={name} photo={photo} size="s" px={28} />
                  <span className="flex-1 min-w-0 truncate">{name}</span>
                  <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{inAlready ? "er med" : "finnes"}</span>
                </button>
              </li>
            );
          })}
        </ul>
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

      </div>
    </div>
  );
}
