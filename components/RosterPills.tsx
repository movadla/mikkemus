"use client";

import { useMemo, useState } from "react";
import { deletePlayer, getPlayerRecord } from "@/lib/storage";
import { avatarAccent } from "@/lib/avatarAccent";
import { filterNames, looksLikeTeam, readUsage, sortByRecent } from "@/lib/recentPlayers";
import { ConfirmDialog } from "./ConfirmDialog";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** A search box only earns its place once the list is long enough to need one. */
const SEARCH_FROM = 9;

/**
 * Players from earlier matches, as tappable pills: the people from last time first, a search
 * once the list gets long, and a clean-up mode for removing names that should not be there.
 *
 * Clean-up is here because the list had filled with names that are not people — teams entered
 * as players ("Vadla & Lars") — and there was no way to get rid of them short of opening each
 * one's own statistics page. In that mode every pill carries a ✕, names that look like teams are
 * marked, and removing one asks first: it deletes the player's statistics with them.
 */
export function RosterPills({
  names,
  onPick,
  size = "normal",
}: {
  /** The players that can still be picked — the ones already in the match are left out. */
  names: string[];
  onPick: (name: string) => void;
  size?: "normal" | "small";
}) {
  const [query, setQuery] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const sorted = useMemo(() => sortByRecent(names, readUsage()), [names]);
  const shown = filterNames(sorted, query);
  if (names.length === 0) return null;

  const pad = size === "small" ? "px-2.5 py-1 text-sm" : "pl-1.5 pr-3 py-1.5";

  return (
    <div>
      {removing && (
        <ConfirmDialog
          message={`Slette «${removing}»? Statistikken til spilleren slettes også, og det kan ikke angres.`}
          buttons={[
            { label: "Nei, behold", onClick: () => setRemoving(null), background: "var(--color-green)" },
            {
              label: "Ja, slett",
              onClick: () => {
                deletePlayer(removing);
                setRemoving(null);
              },
              background: "var(--color-red)",
            },
          ]}
        />
      )}

      {names.length >= SEARCH_FROM && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk etter spiller"
          aria-label="Søk etter spiller"
          className={`w-full px-3 py-2 rounded-lg mb-3 ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "0.9rem" }}
        />
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {shown.map((n) => {
          const photo = getPlayerRecord(n)?.photo;
          const teamLike = cleaning && looksLikeTeam(n);
          return (
            <span key={n} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => (cleaning ? setRemoving(n) : onPick(n))}
                className={`tactile flex items-center gap-2 rounded-full ${pad} ${FOCUS_RING}`}
                style={{
                  background: "var(--color-surface)",
                  border: teamLike ? "1.5px dashed var(--color-red)" : "1px solid var(--color-border)",
                }}
                aria-label={cleaning ? `Slett ${n}` : undefined}
              >
                <span
                  className="w-6 h-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ background: "var(--color-cell)", border: `1.5px solid ${avatarAccent(n)}` }}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span style={{ color: avatarAccent(n), fontSize: "0.7rem" }}>{n.charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <span style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>{n}</span>
                {cleaning && <span aria-hidden style={{ color: "var(--color-red)", fontSize: "0.9rem" }}>✕</span>}
              </button>
              {teamLike && (
                <span style={{ color: "var(--color-red)", fontSize: "0.7rem" }}>ser ut som et lag</span>
              )}
            </span>
          );
        })}
        {shown.length === 0 && (
          <p style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>Ingen spillere heter noe slikt.</p>
        )}
      </div>

      <div className="flex justify-center mt-3">
        <button
          type="button"
          onClick={() => setCleaning((v) => !v)}
          aria-pressed={cleaning}
          className={`tactile px-3 py-1.5 rounded-lg text-xs ${FOCUS_RING}`}
          style={{
            background: cleaning ? "rgba(196, 67, 46, 0.15)" : "transparent",
            color: cleaning ? "var(--color-red)" : "var(--color-muted)",
            border: `1px solid ${cleaning ? "var(--color-red)" : "var(--color-border)"}`,
          }}
        >
          {cleaning ? "Ferdig med opprydding" : "Rydd opp i spillere"}
        </button>
      </div>
      {cleaning && (
        <p className="text-center mt-2" style={{ color: "var(--color-muted)", fontSize: "0.78rem" }}>
          Trykk på en spiller for å slette den. Navn som ser ut som lag er merket.
        </p>
      )}
    </div>
  );
}
