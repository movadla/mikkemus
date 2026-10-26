import { cupColor, type CupConfig } from "@/lib/botCup";
import { CupEmblem } from "./ui/CupEmblem";

/**
 * The title card of a cup, the same on the draw, the overview and the big screen: the cup's emblem in its own colour, its name,
 * and the trophy it is played for, on a stripe of that colour. A tournament that is not a cup has none.
 */
export function CupBanner({ cup, name, large = false }: { cup: CupConfig; name?: string; large?: boolean }) {
  const colour = cupColor(cup.kind);
  return (
    <div
      className="flex items-center gap-3 mb-4"
      style={{
        padding: large ? "1rem 1.5rem" : "0.75rem 1rem",
        borderRadius: "var(--radius-m)",
        background: `linear-gradient(90deg, color-mix(in srgb, ${colour} 20%, var(--color-surface)), var(--color-surface) 75%)`,
        border: "1px solid var(--color-border)",
        borderLeft: `6px solid ${colour}`,
      }}
    >
      <span style={{ color: colour }}>
        <CupEmblem kind={cup.kind} className={large ? "w-12 h-12" : "w-8 h-8"} />
      </span>
      <div className="min-w-0">
        <p className="font-display truncate" style={{ color: "var(--color-cream)", fontSize: large ? "var(--text-num)" : "var(--text-title)", lineHeight: 1.1 }}>
          {name || cup.name}
        </p>
        <p style={{ color: colour, fontSize: large ? "var(--text-body)" : "var(--text-small)", fontWeight: 600 }}>{cup.trophy}</p>
      </div>
    </div>
  );
}
