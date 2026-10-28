"use client";

import { useState } from "react";
import { setKits, setWalkOn, teamKitsOf, type PlayerRecord } from "@/lib/storage";
import { WALK_ON_LABELS, playWalkOnTune, primeAudio } from "@/lib/fanfare";
import { PATTERNS, PATTERN_LABELS, colourName, defaultKits, makeKit, usesSecondColour, type Kit, type TeamKits } from "@/lib/teamKit";
import { byHue, checkOn, suggestPatternColours } from "@/lib/kitColours";
import { KitStage, TeamKit } from "./TeamKit";
import { CheckIcon } from "./icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** The colour slot being picked: the main colour, or the pattern colour. */
type Slot = "primary" | "secondary";

/**
 * One shirt: a large preview that stays at the top while the rest is chosen (the shirt from the front and from behind, with the name
 * printed on it), then the style, then two colours — a main colour and a pattern colour — as round swatches in a row like a spectrum, with
 * three suggestions for a pattern colour that goes with the main one. Every tap is saved at once. A plain shirt has one colour, so the
 * second slot is off.
 */
export function KitEditor({ label, kit, onChange, name }: { label: string; kit: Kit; onChange: (kit: Kit) => void; name: string }) {
  const [slot, setSlot] = useState<Slot>("primary");
  const two = usesSecondColour(kit.pattern);
  const active: Slot = two ? slot : "primary";
  const current = active === "primary" ? kit.primary : kit.secondary;
  const row = byHue();
  const suggestions = two ? suggestPatternColours(kit.primary) : [];

  function pick(hex: string) {
    onChange(makeKit(kit.pattern, active === "primary" ? hex : kit.primary, active === "secondary" ? hex : kit.secondary));
    if (two && active === "primary") setSlot("secondary");
  }
  const slotStyle = (s: Slot, off = false) => ({
    minHeight: "var(--control-lg)",
    background: active === s ? "var(--teal-soft)" : "var(--color-surface)",
    border: active === s ? "1px solid var(--color-teal)" : "1px solid var(--color-border)",
    opacity: off ? 0.5 : 1,
  });
  const swatch = (hex: string, name: string, selected: boolean, onPick: () => void, small = false) => (
    <button key={hex} type="button" aria-pressed={selected} aria-label={name} title={name} onClick={onPick} className={`swatch ${small ? "swatch-small" : ""} tactile ${FOCUS_RING}`} style={{ background: hex }}>
      {selected && <CheckIcon className={`w-5 h-5 ${checkOn(hex) === "light" ? "swatch-check-light" : "swatch-check-dark"}`} />}
    </button>
  );

  return (
    <div className="mb-6">
      <p className="section-label mb-2">{label}</p>
      {/* The shirt, large, and it stays in view while the sheet is scrolled: what is chosen below is seen here at once. */}
      <div className="kit-preview" role="group" aria-label={`${label}: forhåndsvisning, foran og bak`}>
        <KitStage kit={kit} size={88} title="Drakten sett forfra" />
        <KitStage kit={kit} size={88} back label={name} number={1} title="Drakten sett bakfra" />
      </div>

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
              className={`tactile rounded-lg flex flex-col items-center justify-center gap-1 ${FOCUS_RING}`}
              style={{
                minHeight: "5.75rem",
                background: selected ? "var(--teal-soft)" : "var(--color-surface)",
                border: selected ? "2px solid var(--color-teal)" : "1px solid var(--color-border)",
                boxShadow: selected ? "var(--elevation-1)" : "var(--elevation-0)",
              }}
            >
              <TeamKit kit={makeKit(p, kit.primary, kit.secondary)} size={46} />
              <span style={{ color: selected ? "var(--color-cream)" : "var(--color-muted)", fontSize: "var(--text-micro)", fontWeight: selected ? 700 : 400 }}>{PATTERN_LABELS[p]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "minmax(0, 1fr) 2.75rem minmax(0, 1fr)" }}>
        <button type="button" aria-pressed={active === "primary"} onClick={() => setSlot("primary")} className={`tactile flex items-center gap-2 px-3 rounded-lg text-left ${FOCUS_RING}`} style={slotStyle("primary")}>
          <span className="rounded-full shrink-0" style={{ width: 28, height: 28, background: kit.primary, border: "2px solid rgba(255,255,255,0.35)" }} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Hovedfarge</span>
            <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{colourName(kit.primary)}</span>
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
            <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{two ? colourName(kit.secondary) : "ikke brukt"}</span>
          </span>
        </button>
      </div>

      <p className="section-label mb-2" aria-live="polite">
        {active === "primary" ? "HOVEDFARGE" : "MØNSTERFARGE"} · {colourName(current).toUpperCase()}
      </p>
      <div className="flex flex-wrap gap-3 mb-4" role="group" aria-label={`${label}: farger`}>
        {row.map((c) => swatch(c.hex, c.name, current.toLowerCase() === c.hex.toLowerCase(), () => pick(c.hex)))}
        {/* Any other colour: the phone's own colour picker. */}
        <label className={`swatch swatch-custom tactile ${FOCUS_RING}`} title="Egen farge">
          <span className="sr-only">Egen farge</span>
          <input type="color" value={current} onChange={(e) => pick(e.target.value.toLowerCase())} className="sr-only" />
        </label>
      </div>

      {two && suggestions.length > 0 && (
        <div className="flex items-center gap-3">
          <span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Passer til {colourName(kit.primary).toLowerCase()}:</span>
          <div className="flex gap-2" role="group" aria-label="Forslag til mønsterfarge">
            {suggestions.map((c) => swatch(c.hex, `Forslag: ${c.name}`, kit.secondary.toLowerCase() === c.hex.toLowerCase(), () => onChange(makeKit(kit.pattern, kit.primary, c.hex)), true))}
          </div>
        </div>
      )}
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
                style={{ minHeight: "var(--control)", background: selected ? "var(--teal-soft)" : "var(--color-surface)", color: selected ? "var(--color-teal)" : "var(--color-muted)", border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
              >
                {WALK_ON_LABELS[w]}
              </button>
            );
          })}
        </div>
      </div>
  );
}

/** A player's one shirt: the style and the two colours. Kept as both of the pair a team has. */
export function PlayerKitEditor({ player }: { player: PlayerRecord }) {
  const kit = teamKitsOf(player).home;
  return (
    <div>
      <KitEditor label="DRAKT" name={player.name} kit={kit} onChange={(next) => setKits(player.name, { home: next, away: next })} />
      <button
        type="button"
        onClick={() => setKits(player.name, defaultKits([player.name]))}
        className={`tactile w-full rounded-lg text-sm ${FOCUS_RING}`}
        style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
      >
        Standard
      </button>
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
  const save = (next: TeamKits) => setKits(team.name, next);
  return (
    <div>
      <WalkOnPicker record={team} />
      <KitEditor label="HJEMME" name={team.name} kit={kits.home} onChange={(home) => save({ ...kits, home })} />
      <KitEditor label="BORTE" name={team.name} kit={kits.away} onChange={(away) => save({ ...kits, away })} />
      <button
        type="button"
        onClick={() => save(defaultKits(team.members ?? []))}
        className={`tactile w-full rounded-lg text-sm ${FOCUS_RING}`}
        style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
      >
        Standard
      </button>
    </div>
  );
}
