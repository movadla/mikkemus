"use client";

import { useState } from "react";
import { SpotifyControl } from "./SpotifyControl";
import { FX_LABELS, FX_LEVELS, setFxLevel, useFxLevel } from "@/lib/fxLevel";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The animation level, changed in the middle of a match: Enkel, Vanlig, Party or Full party. The choice
 * is the same one as in Innstillinger and takes effect from the next dart — nothing about the match
 * itself changes. Tap outside, or a level, to close.
 */
export function FxMenu({ onClose }: { onClose: () => void }) {
  const level = useFxLevel();
  // Enkel replaces the board with the chalkboard and the match so far does not count, so it asks first.
  const [askSimple, setAskSimple] = useState(false);
  return (
    <div className="fixed inset-0 z-[56] flex items-start justify-center px-4" role="dialog" aria-modal="true" aria-label="Effekter">
      <button type="button" aria-label="Lukk" onClick={onClose} className="absolute inset-0 w-full h-full" style={{ background: "rgba(0,0,0,0.5)" }} />
      <div className="relative mt-16 w-full max-w-sm rounded-2xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <p className="section-label text-center mb-3">ANIMASJON OG LYD</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Animasjon og lyd">
          {FX_LEVELS.map((l) => {
            const selected = level === l;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  if (l === "simple" && level !== "simple") {
                    setAskSimple(true);
                    return;
                  }
                  setAskSimple(false);
                  setFxLevel(l);
                  onClose();
                }}
                className={`tactile rounded-lg font-medium ${FOCUS_RING}`}
                style={{
                  minHeight: "3rem",
                  background: selected ? "var(--teal-soft)" : "var(--color-cell)",
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
        {askSimple && (
          <div className="mt-3 rounded-lg p-3 text-center" style={{ background: "var(--color-cell)", border: "1px solid var(--color-red)" }}>
            <p style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>Bytt til Enkel? Kampen teller ikke.</p>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setAskSimple(false)} className={`tactile flex-1 rounded-lg ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => {
                  setFxLevel("simple");
                  onClose();
                }}
                className={`tactile flex-1 rounded-lg font-medium ${FOCUS_RING}`}
                style={{ minHeight: "2.75rem", background: "var(--color-red)", color: "var(--color-bg)" }}
              >
                Bytt til Enkel
              </button>
            </div>
          </div>
        )}
        <SpotifyControl compact />
      </div>
    </div>
  );
}
