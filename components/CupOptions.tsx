"use client";

import { useEffect, useRef } from "react";
import { BOT_LEVELS, BOT_LEVEL_PICKABLE, type BotLevel } from "@/lib/botLevels";
import { CUP_SIZES, CUP_TYPES, cupColor, cupType, type CupKind } from "@/lib/botCup";
import { VENUES, venueForCup } from "@/lib/venues";
import { picturesFor } from "./eventPictures";
import { CupEmblem } from "./ui/CupEmblem";
import { LevelBadge } from "./LevelBadge";
import { Chip } from "./ui/Chip";
import { FOCUS_RING } from "./ui/focus";

/** The same cups as in the career, the smallest first; Ly Pilotturnering last, with its format of its own. */
const LADDER_ORDER: CupKind[] = ["lu", "region", "nm", "gs", "vm", "open", "em"];

export type CupChoice = { kind: CupKind; size: number; level: BotLevel; growth: boolean };

/**
 * Which cup, as posters to leaf through: each is a card in the cup's own colour with its emblem large, its name and the trophy it is
 * played for. The chosen one is lit and kept in view; the rest wait on either side. A swipe or the arrow keys move along.
 */
export function CupTypePicker({ value, onChange, maxSize }: { value: CupChoice; onChange: (v: CupChoice) => void; maxSize: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[aria-checked=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [value.kind]);
  return (
    <div ref={box} className="cup-posters mb-6" role="radiogroup" aria-label="Turnering">
      {[...CUP_TYPES].filter((t) => !t.retired).sort((a, b) => LADDER_ORDER.indexOf(a.kind) - LADDER_ORDER.indexOf(b.kind)).map((t) => {
        const selected = t.kind === value.kind;
        // The place the cup is played in is fixed by the cup (Ally Pally for the world championship), and its picture is behind the card.
        const place = VENUES.find((v) => v.id === venueForCup(t.kind));
        const pic = place ? picturesFor({ id: place.tier, key: place.key })?.outside : undefined;
        return (
          <button
            key={t.kind}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange({ ...value, kind: t.kind, size: Math.min(t.defaultSize, maxSize) })}
            className={`cup-poster tactile ${FOCUS_RING}`}
            style={{ "--cup": cupColor(t.kind), ...(pic ? { "--pic": `url(${pic})` } : {}) } as React.CSSProperties}
          >
            <span className="cup-poster-emblem">
              <CupEmblem kind={t.kind} className="w-8 h-8" />
            </span>
            <span className="font-display cup-poster-name">
              {t.name}
            </span>
            <span className="cup-poster-trophy">{t.trophy}</span>
          </button>
        );
      })}
    </div>
  );
}

/** How many take part, with the one line that matters: how many bots that makes. */
export function CupSizePicker({ value, onChange, own, maxSize, any = false }: { value: CupChoice; onChange: (v: CupChoice) => void; own: number; maxSize: number; /** Every size, whichever cup it is: for teams. */ any?: boolean }) {
  const sizes = (any ? CUP_SIZES : cupType(value.kind).sizes).filter((n) => n <= maxSize);
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
            style={{ minHeight: "2.4rem", fontSize: "var(--text-body)", background: n === value.size ? "var(--color-teal)" : "var(--color-surface)", color: n === value.size ? "var(--color-bg)" : "var(--color-cream)", fontWeight: n === value.size ? 700 : 400, border: n === value.size ? "2px solid var(--color-teal)" : "1px solid var(--color-border)" }}
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
