"use client";

import { BOT_LEVELS, BOT_LEVEL_PICKABLE, type BotLevel } from "@/lib/botLevels";
import { CUP_TYPES, cupType, type CupKind } from "@/lib/botCup";
import { LevelBadge } from "./LevelBadge";
import { Chip } from "./ui/Chip";
import { FOCUS_RING } from "./ui/focus";

export type CupChoice = { kind: CupKind; size: number; level: BotLevel; growth: boolean };

/** Which cup: the names only, two to a row. */
export function CupTypePicker({ value, onChange, maxSize }: { value: CupChoice; onChange: (v: CupChoice) => void; maxSize: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-6" role="group" aria-label="Turnering">
      {CUP_TYPES.map((t) => {
        const selected = t.kind === value.kind;
        return (
          <Chip key={t.kind} block selected={selected} onClick={() => onChange({ ...value, kind: t.kind, size: Math.min(t.defaultSize, maxSize) })}>
            {t.name}
          </Chip>
        );
      })}
    </div>
  );
}

/** How many take part, with the one line that matters: how many bots that makes. */
export function CupSizePicker({ value, onChange, own, maxSize }: { value: CupChoice; onChange: (v: CupChoice) => void; own: number; maxSize: number }) {
  const sizes = cupType(value.kind).sizes.filter((n) => n <= maxSize);
  return (
    <div className="mb-6">
      <div className="grid grid-cols-3 gap-2 mb-2">
        {sizes.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === value.size}
            onClick={() => onChange({ ...value, size: n })}
            className={`tactile rounded-lg font-display tabular ${FOCUS_RING}`}
            style={{ minHeight: "var(--control-lg)", fontSize: "var(--text-num)", background: n === value.size ? "var(--teal-soft)" : "var(--color-surface)", color: n === value.size ? "var(--color-teal)" : "var(--color-cream)", border: n === value.size ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
          >
            {n}
          </button>
        ))}
      </div>
      {own >= value.size && (
        <p style={{ color: "var(--color-red)", fontSize: "var(--text-small)" }}>For mange</p>
      )}
    </div>
  );
}

/** The two things about the bots, for the rarely opened "Flere valg". */
export function CupDetails({ value, onChange }: { value: CupChoice; onChange: (v: CupChoice) => void }) {
  return (
    <div className="mb-5">
      <p className="section-label mb-2">NIVÅ</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {BOT_LEVEL_PICKABLE.map((l) => (
          <Chip key={l} selected={l === value.level} onClick={() => onChange({ ...value, level: l })} label={`${BOT_LEVELS[l].name}, ${BOT_LEVELS[l].targetMed} mm`}>
            <span className="inline-flex items-center gap-1">
              {BOT_LEVELS[l].name}
              <LevelBadge level={l} />
            </span>
          </Chip>
        ))}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value.growth}
        onClick={() => onChange({ ...value, growth: !value.growth })}
        className={`tactile w-full rounded-lg px-4 flex items-center justify-between gap-3 text-left ${FOCUS_RING}`}
        style={{ minHeight: "var(--control)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <span style={{ color: "var(--color-cream)", fontWeight: 600, fontSize: "var(--text-body)" }}>Boter vokser</span>
        <span aria-hidden style={{ color: value.growth ? "var(--color-green)" : "var(--color-muted)", fontWeight: 700 }}>{value.growth ? "På" : "Av"}</span>
      </button>
    </div>
  );
}
