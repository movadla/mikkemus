"use client";

import { BOT_LEVELS, BOT_LEVEL_PICKABLE, botLevelBadge, type BotLevel } from "@/lib/botLevels";
import { CUP_SIZES, CUP_TYPES, DEFAULT_CUP_LEVEL, type CupKind } from "@/lib/botCup";

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
      className={`tactile rounded-lg px-3 ${FOCUS_RING}`}
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

/** What a cup against bots is made of: which cup, how many take part, how good the bots are, and whether they grow. */
export function CupOptions({ value, onChange, maxOwn }: { value: CupChoice; onChange: (v: CupChoice) => void; maxOwn: number }) {
  const set = (patch: Partial<CupChoice>) => onChange({ ...value, ...patch });
  return (
    <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
      <p className="section-label mb-2">TURNERING</p>
      <div className="grid grid-cols-1 gap-2 mb-5">
        {CUP_TYPES.map((t) => {
          const selected = t.kind === value.kind;
          return (
            <button
              key={t.kind}
              type="button"
              aria-pressed={selected}
              onClick={() => set({ kind: t.kind, size: t.defaultSize })}
              className={`tactile rounded-lg px-4 py-2 text-left ${FOCUS_RING}`}
              style={{ minHeight: "3.25rem", background: selected ? "var(--teal-soft)" : "var(--color-cell)", border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)" }}
            >
              <span className="block" style={{ color: selected ? "var(--color-teal)" : "var(--color-cream)", fontWeight: 700 }}>{t.name}</span>
              <span className="block" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                {t.tagline} · {t.trophy}
              </span>
            </button>
          );
        })}
      </div>

      <p className="section-label mb-2">ANTALL I TURNERINGEN</p>
      <div className="flex flex-wrap gap-2 mb-1">
        {CUP_SIZES.map((n) => (
          <Chip key={n} selected={n === value.size} onClick={() => set({ size: n })}>
            {n}
          </Chip>
        ))}
      </div>
      <p className="mb-5" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
        Dere og botene til sammen{maxOwn >= value.size ? " — det er for mange av dere til dette antallet" : ""}.
      </p>

      <p className="section-label mb-2">MOTSTANDERNES NIVÅ</p>
      <div className="flex flex-wrap gap-2 mb-1">
        {BOT_LEVEL_PICKABLE.map((l) => (
          <Chip key={l} selected={l === value.level} onClick={() => set({ level: l })} label={`${BOT_LEVELS[l].name}, ${BOT_LEVELS[l].targetMed} mm`}>
            {BOT_LEVELS[l].name} {botLevelBadge(l)}
          </Chip>
        ))}
      </div>
      <p className="mb-5" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
        {BOT_LEVELS[value.level].name}: kaster rundt {BOT_LEVELS[value.level].targetMed} mm fra midten{value.level === DEFAULT_CUP_LEVEL ? " — omtrent snittet vårt" : ""}. Hver bot er litt bedre eller dårligere enn det, og varierer fra kamp til kamp.
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={value.growth}
        onClick={() => set({ growth: !value.growth })}
        className={`tactile w-full rounded-lg px-4 py-2 flex items-center justify-between gap-3 text-left ${FOCUS_RING}`}
        style={{ minHeight: "3.25rem", background: "var(--color-cell)", border: "1px solid var(--color-border)" }}
      >
        <span>
          <span className="block" style={{ color: "var(--color-cream)", fontWeight: 600 }}>Botene blir bedre underveis</span>
          <span className="block" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>Litt svakere i gruppespillet, sterkest i finalen</span>
        </span>
        <span aria-hidden style={{ color: value.growth ? "var(--color-green)" : "var(--color-muted)", fontWeight: 700 }}>{value.growth ? "På" : "Av"}</span>
      </button>
    </div>
  );
}
