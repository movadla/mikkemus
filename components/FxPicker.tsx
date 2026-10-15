"use client";

import { FX_LABELS, FX_LEVELS, setFxLevel, useFxLevel, type FxLevel } from "@/lib/fxLevel";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const HINTS: Record<FxLevel, string> = {
  normal: "Rolig: én myk lyd per treff, ingen risting eller konfetti.",
  party: "Boom som bygger seg opp, risting, glød og konfetti.",
  full: "Alt i Party, pluss publikum under en rekke og dobbelt konfetti.",
};

/**
 * Vanlig / Party / Full party. A setting of the device, not of the match — it is remembered and
 * applies to every game until changed, so it sits with the other setup choices but is not
 * passed along with them.
 */
export function FxPicker() {
  const level = useFxLevel();
  return (
    <div className="mb-6">
      <p className="section-label text-center mb-2">ANIMASJON OG LYD</p>
      <div className="flex gap-2" role="radiogroup" aria-label="Animasjon og lyd">
        {FX_LEVELS.map((l) => {
          const selected = level === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setFxLevel(l)}
              className={`tactile flex-1 py-2 rounded-lg font-medium ${FOCUS_RING}`}
              style={{
                background: selected ? "rgba(47, 180, 194, 0.18)" : "var(--color-surface)",
                color: selected ? "var(--color-teal)" : "var(--color-muted)",
                border: selected ? "1px solid var(--color-teal)" : "1px solid var(--color-border)",
                fontSize: "0.9rem",
              }}
            >
              {FX_LABELS[l]}
            </button>
          );
        })}
      </div>
      <p className="text-center mt-1.5" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
        {HINTS[level]}
      </p>
    </div>
  );
}
