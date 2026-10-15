"use client";

import { RULES, VARIANT_ORDER, baseOf, hasStandRule, withBase, withStandRule, type GameVariant } from "@/lib/rules";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The two rule choices of a match, in one place so singel play and tournaments offer exactly the
 * same thing: how many crosses close a row, and — in team play — whether a thrower with three
 * counting darts stays on. Both live in the one `GameVariant` string (see lib/rules.ts).
 *
 * No explanations: the people at the board play this every week. What stays is the one line
 * that says a length other than three is not counted in the statistics, because that is a
 * consequence rather than a description.
 */
export function RulesPicker({
  variant,
  onChange,
  teamPlay,
}: {
  variant: GameVariant;
  onChange: (next: GameVariant) => void;
  /** Whether the stand rule is on offer — it only means something when a team has several members. */
  teamPlay: boolean;
}) {
  const base = baseOf(variant);
  const stand = hasStandRule(variant);

  return (
    <div className="mb-6">
      <p className="section-label text-center mb-2">KRYSS PER RAD</p>
      <div className="flex gap-2" role="radiogroup" aria-label="Kryss per rad">
        {VARIANT_ORDER.map((v) => {
          const selected = base === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(withBase(variant, v))}
              className={`tactile flex-1 rounded-lg font-medium tabular ${FOCUS_RING}`}
              style={{
                minHeight: "2.75rem",
                fontSize: "1.05rem",
                background: selected ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)",
                color: selected ? "var(--color-teal)" : "var(--color-muted)",
                border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)",
              }}
            >
              {RULES[v].target}
            </button>
          );
        })}
      </div>
      {!RULES[base].countsForStats && (
        <p className="text-center mt-2" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
          Teller ikke i statistikken
        </p>
      )}

      {teamPlay && (
        <button
          type="button"
          role="switch"
          aria-checked={stand}
          onClick={() => onChange(withStandRule(variant, !stand))}
          className={`tactile w-full mt-4 px-4 rounded-lg flex items-center justify-between gap-4 text-left ${FOCUS_RING}`}
          style={{
            minHeight: "2.75rem",
            background: stand ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)",
            border: stand ? "1px solid var(--color-teal)" : "1px solid var(--color-border)",
          }}
        >
          <span className="font-medium" style={{ color: stand ? "var(--color-teal)" : "var(--color-cream)", fontSize: "0.9rem" }}>
            Stå ved 3 tellende piler
          </span>
          <span
            aria-hidden
            className="shrink-0 rounded-full relative"
            style={{ width: "2.4rem", height: "1.4rem", background: stand ? "var(--color-teal)" : "var(--color-cell)", transition: "background 150ms" }}
          >
            <span
              className="absolute rounded-full"
              style={{ top: "0.2rem", left: stand ? "1.2rem" : "0.2rem", width: "1rem", height: "1rem", background: "var(--color-cream)", transition: "left 150ms" }}
            />
          </span>
        </button>
      )}
    </div>
  );
}
