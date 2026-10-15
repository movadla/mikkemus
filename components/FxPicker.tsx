"use client";

import { FX_LABELS, FX_LEVELS, setFxLevel, useFxLevel } from "@/lib/fxLevel";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * Vanlig / Party / Full party. A setting of the device, not of the match — it lives in
 * Innstillinger and applies to every game until changed. The names say what they are; the
 * sentence that used to explain each level under the buttons is gone.
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
              className={`tactile flex-1 rounded-lg font-medium ${FOCUS_RING}`}
              style={{
                minHeight: "2.75rem",
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
    </div>
  );
}
