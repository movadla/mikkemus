"use client";

import { useState } from "react";
import { setTeamKits, setWalkOn, teamKitsOf, type PlayerRecord } from "@/lib/storage";
import { WALK_ON_LABELS, playWalkOnTune, primeAudio } from "@/lib/fanfare";
import { KIT_COLOURS, PATTERNS, PATTERN_LABELS, colourName, defaultKits, makeKit, usesSecondColour, type Kit, type TeamKits } from "@/lib/teamKit";
import { TeamKit } from "./TeamKit";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** The colour slot being picked: the main colour, or the pattern colour. */
type Slot = "primary" | "secondary";

/**
 * One shirt: first the style, then two colours — a main colour and a pattern colour, picked from
 * sixteen. Every tap is saved at once. A plain shirt has one colour, so the second slot is off.
 */
function KitEditor({ label, kit, onChange }: { label: string; kit: Kit; onChange: (kit: Kit) => void }) {
  const [slot, setSlot] = useState<Slot>("primary");
  const two = usesSecondColour(kit.pattern);
  const active: Slot = two ? slot : "primary";

  function pick(hex: string) {
    onChange(makeKit(kit.pattern, active === "primary" ? hex : kit.primary, active === "secondary" ? hex : kit.secondary));
    if (two && active === "primary") setSlot("secondary");
  }
  const slotStyle = (s: Slot, off = false) => ({
    minHeight: "3.25rem",
    background: active === s ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)",
    border: active === s ? "1px solid var(--color-teal)" : "1px solid var(--color-border)",
    opacity: off ? 0.5 : 1,
  });

  return (
    <div className="mb-6">
      <p className="section-label mb-2">{label}</p>
      <div className="grid grid-cols-5 gap-2 mb-4" role="radiogroup" aria-label={`${label}: stil`}>
        {PATTERNS.map((p) => {
          const selected = p === kit.pattern;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(makeKit(p, kit.primary, kit.secondary))}
              className={`tactile rounded-lg flex flex-col items-center justify-center gap-0.5 ${FOCUS_RING}`}
              style={{ minHeight: "4.25rem", background: selected ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)", border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
            >
              <TeamKit kit={makeKit(p, kit.primary, kit.secondary)} size={34} />
              <span style={{ color: selected ? "var(--color-teal)" : "var(--color-muted)", fontSize: "0.72rem" }}>{PATTERN_LABELS[p]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "minmax(0, 1fr) 2.75rem minmax(0, 1fr)" }}>
        <button type="button" aria-pressed={active === "primary"} onClick={() => setSlot("primary")} className={`tactile flex items-center gap-2 px-3 rounded-lg text-left ${FOCUS_RING}`} style={slotStyle("primary")}>
          <span className="rounded-full shrink-0" style={{ width: 28, height: 28, background: kit.primary, border: "2px solid rgba(255,255,255,0.35)" }} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Hovedfarge</span>
            <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{colourName(kit.primary)}</span>
          </span>
        </button>
        <button
          type="button"
          aria-label="Bytt de to fargene"
          disabled={!two}
          onClick={() => onChange(makeKit(kit.pattern, kit.secondary, kit.primary))}
          className={`tactile rounded-lg ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", opacity: two ? 1 : 0.5 }}
        >
          ⇄
        </button>
        <button type="button" aria-pressed={active === "secondary"} disabled={!two} onClick={() => setSlot("secondary")} className={`tactile flex items-center gap-2 px-3 rounded-lg text-left ${FOCUS_RING}`} style={slotStyle("secondary", !two)}>
          <span className="rounded-full shrink-0" style={{ width: 28, height: 28, background: two ? kit.secondary : "transparent", border: "2px solid rgba(255,255,255,0.35)" }} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Mønsterfarge</span>
            <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{two ? colourName(kit.secondary) : "ikke brukt"}</span>
          </span>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2" role="group" aria-label={`${label}: farger`}>
        {KIT_COLOURS.map((c) => {
          const selected = (active === "primary" ? kit.primary : kit.secondary).toLowerCase() === c.hex;
          return (
            <button
              key={c.hex}
              type="button"
              aria-pressed={selected}
              aria-label={c.name}
              title={c.name}
              onClick={() => pick(c.hex)}
              className={`tactile rounded-lg flex items-center justify-center ${FOCUS_RING}`}
              style={{ minHeight: "2.75rem", background: c.hex, border: selected ? "3px solid #fff" : "2px solid rgba(255,255,255,0.18)", color: "#0b0b0b" }}
            >
              {selected && <span aria-hidden style={{ fontWeight: 700, textShadow: "0 0 3px #fff" }}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The tune a player or a team walks on to when it becomes their turn (full party only). Every tap is saved, and the tune plays once. */
export function WalkOnPicker({ record }: { record: PlayerRecord }) {
  return (
      <div className="mb-6">
        <p className="section-label mb-2">INNMARSJ</p>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Innmarsj">
          {(["none", "fanfare", "rock", "disco"] as const).map((w) => {
            const selected = (record.walkOn ?? "none") === w;
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setWalkOn(record.name, w);
                  if (w !== "none") {
                    primeAudio();
                    playWalkOnTune(w);
                  }
                }}
                className={`tactile rounded-lg text-sm ${FOCUS_RING}`}
                style={{ minHeight: "2.75rem", background: selected ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)", color: selected ? "var(--color-teal)" : "var(--color-muted)", border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
              >
                {WALK_ON_LABELS[w]}
              </button>
            );
          })}
        </div>
      </div>
  );
}

/**
 * One team's walk-on tune and its two shirts, with the places to change them. A team's shirts are its own and the
 * same on every device (lib/playerRows.ts). Every tap is saved at once; «Standard» puts the two default shirts back.
 * It sits on the team's own page (Spillere).
 */
export function TeamKitEditor({ team }: { team: PlayerRecord }) {
  const kits = teamKitsOf(team);
  const save = (next: TeamKits) => setTeamKits(team.name, next);
  return (
    <div>
      <WalkOnPicker record={team} />
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
  );
}
