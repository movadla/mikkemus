"use client";

import { BOT_LEVELS, BOT_LEVEL_PICKABLE, botLevelBadge, type BotLevel } from "@/lib/botLevels";
import { CUP_TYPES, cupType, type CupKind } from "@/lib/botCup";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

export type CupChoice = { kind: CupKind; size: number; level: BotLevel; growth: boolean };

function Chip({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={`tactile rounded-lg px-4 ${FOCUS_RING}`}
      style={{
        minHeight: "2.75rem",
        background: selected ? "var(--teal-soft)" : "var(--color-surface)",
        color: selected ? "var(--color-teal)" : "var(--color-cream)",
        border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

/** Which cup: the names only, two to a row. */
export function CupTypePicker({ value, onChange, maxSize }: { value: CupChoice; onChange: (v: CupChoice) => void; maxSize: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-6" role="radiogroup" aria-label="Turnering">
      {CUP_TYPES.map((t) => {
        const selected = t.kind === value.kind;
        return (
          <button
            key={t.kind}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange({ ...value, kind: t.kind, size: Math.min(t.defaultSize, maxSize) })}
            className={`tactile rounded-lg px-3 text-left truncate ${FOCUS_RING}`}
            style={{ minHeight: "2.75rem", background: selected ? "var(--teal-soft)" : "var(--color-surface)", border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)", color: selected ? "var(--color-teal)" : "var(--color-cream)", fontWeight: 600, fontSize: "0.9rem" }}
          >
            {t.name}
          </button>
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
            style={{ minHeight: "3.25rem", fontSize: "1.5rem", background: n === value.size ? "var(--teal-soft)" : "var(--color-surface)", color: n === value.size ? "var(--color-teal)" : "var(--color-cream)", border: n === value.size ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
          >
            {n}
          </button>
        ))}
      </div>
      <p style={{ color: own >= value.size ? "var(--color-red)" : "var(--color-muted)", fontSize: "0.8rem" }}>
        {own >= value.size ? "For mange spillere til dette antallet" : `${own} av dere + ${value.size - own} botter`}
      </p>
    </div>
  );
}

/** The two things about the bots, for the rarely opened "Flere valg". */
export function CupDetails({ value, onChange }: { value: CupChoice; onChange: (v: CupChoice) => void }) {
  return (
    <div className="mb-5">
      <p className="section-label mb-2">BOTNIVÅ</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {BOT_LEVEL_PICKABLE.map((l) => (
          <Chip key={l} selected={l === value.level} onClick={() => onChange({ ...value, level: l })} label={`${BOT_LEVELS[l].name}, ${BOT_LEVELS[l].targetMed} mm`}>
            {BOT_LEVELS[l].name} {botLevelBadge(l)}
          </Chip>
        ))}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value.growth}
        onClick={() => onChange({ ...value, growth: !value.growth })}
        className={`tactile w-full rounded-lg px-4 flex items-center justify-between gap-3 text-left ${FOCUS_RING}`}
        style={{ minHeight: "2.75rem", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <span style={{ color: "var(--color-cream)", fontWeight: 600, fontSize: "0.9rem" }}>Botene blir bedre underveis</span>
        <span aria-hidden style={{ color: value.growth ? "var(--color-green)" : "var(--color-muted)", fontWeight: 700 }}>{value.growth ? "På" : "Av"}</span>
      </button>
    </div>
  );
}
