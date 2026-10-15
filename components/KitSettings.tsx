"use client";

import { useState } from "react";
import { setTeamKits, teamKitsOf, useTeamRecords } from "@/lib/storage";
import { PALETTE, PATTERNS, PATTERN_LABELS, colourIndexOf, defaultKits, kitFrom, type Kit, type TeamKits } from "@/lib/teamKit";
import { TeamKit } from "./TeamKit";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** One shirt's colours and pattern, as two rows of shirts to tap. Each tap is saved at once. */
function KitEditor({ label, kit, onChange }: { label: string; kit: Kit; onChange: (kit: Kit) => void }) {
  const colour = colourIndexOf(kit);
  return (
    <div className="mb-4">
      <p className="section-label mb-2">{label}</p>
      <div className="grid grid-cols-6 gap-2 mb-2" role="radiogroup" aria-label={`${label}: farger`}>
        {PALETTE.map((c, i) => {
          const selected = i === colour;
          return (
            <button
              key={c.primary + c.secondary}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Farger ${i + 1}`}
              onClick={() => onChange(kitFrom(i, kit.pattern))}
              className={`tactile rounded-lg flex items-center justify-center ${FOCUS_RING}`}
              style={{ minHeight: "2.75rem", background: selected ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)", border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
            >
              <TeamKit kit={{ ...c, pattern: kit.pattern }} size={30} />
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={`${label}: mønster`}>
        {PATTERNS.map((p) => {
          const selected = p === kit.pattern;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={PATTERN_LABELS[p]}
              onClick={() => onChange({ ...kit, pattern: p })}
              className={`tactile rounded-lg flex items-center justify-center ${FOCUS_RING}`}
              style={{ minHeight: "2.75rem", background: selected ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)", border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
            >
              <TeamKit kit={{ ...kit, pattern: p }} size={30} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Every saved team's two shirts, and the place to change them. A team's shirts are its own and the
 * same on every device (lib/playerRows.ts); here they are a row per team — home and away — that
 * opens into the colour and pattern choices. «Standard» puts the two default shirts back.
 */
export function KitSettings() {
  const teams = useTeamRecords();
  const [open, setOpen] = useState<string | null>(null);
  if (teams.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="section-label text-center mb-2">DRAKTER</p>
      <div className="space-y-2">
        {teams.map((team) => {
          const kits = teamKitsOf(team);
          const editing = open === team.name;
          const save = (next: TeamKits) => setTeamKits(team.name, next);
          return (
            <div key={team.name} className="rounded-xl" style={{ background: editing ? "var(--color-panel)" : "transparent", border: editing ? "1px solid var(--color-border)" : "1px solid transparent" }}>
              <button
                type="button"
                onClick={() => setOpen(editing ? null : team.name)}
                aria-expanded={editing}
                className={`tactile w-full flex items-center gap-2 pl-4 pr-2 rounded-lg text-left ${FOCUS_RING}`}
                style={{ minHeight: "3.25rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
              >
                <span className="flex-1 min-w-0 truncate">{team.name}</span>
                <TeamKit kit={kits.home} size={30} title="Hjemmedrakt" />
                <TeamKit kit={kits.away} size={30} title="Bortedrakt" />
                <span aria-hidden className="w-6 text-center" style={{ color: "var(--color-muted)" }}>
                  {editing ? "▴" : "▾"}
                </span>
              </button>
              {editing && (
                <div className="p-4">
                  <KitEditor label="HJEMME" kit={kits.home} onChange={(home) => save({ ...kits, home })} />
                  <KitEditor label="BORTE" kit={kits.away} onChange={(away) => save({ ...kits, away })} />
                  <button
                    type="button"
                    onClick={() => save(defaultKits(team.members ?? []))}
                    className={`tactile w-full rounded-lg text-sm ${FOCUS_RING}`}
                    style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
                  >
                    Standard
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
