"use client";

import { useState } from "react";
import { SpotifyControl } from "./SpotifyControl";
import { FX_LABELS, FX_LEVELS, setFxLevel, useFxLevel, type FxLevel } from "@/lib/fxLevel";
import { Button } from "./ui/Button";
import { Segmented } from "./ui/Segmented";
import { Sheet } from "./ui/Sheet";

/**
 * The animation level, changed in the middle of a match: Enkel, Vanlig, Party or Full party. The choice
 * is the same one as in Innstillinger and takes effect from the next dart — nothing about the match
 * itself changes. Enkel replaces the board with the chalkboard, so it asks first.
 */
export function FxMenu({ onClose }: { onClose: () => void }) {
  const level = useFxLevel();
  const [askSimple, setAskSimple] = useState(false);

  function choose(l: FxLevel) {
    if (l === "simple" && level !== "simple") {
      setAskSimple(true);
      return;
    }
    setAskSimple(false);
    setFxLevel(l);
    onClose();
  }

  return (
    <Sheet title="Animasjon og lyd" onClose={onClose}>
      <Segmented value={level} onChange={choose} label="Animasjon og lyd" fit options={FX_LEVELS.map((l) => ({ value: l, label: FX_LABELS[l] }))} />
      {askSimple && (
        <div className="mt-3 card-flat text-center" style={{ borderColor: "var(--color-red)" }}>
          <p style={{ color: "var(--color-cream)", fontSize: "var(--text-body)" }}>Bytt til Enkel? Kampen teller ikke.</p>
          <div className="flex gap-2 mt-3">
            <Button block onClick={() => setAskSimple(false)}>
              Avbryt
            </Button>
            <Button
              block
              variant="danger"
              onClick={() => {
                setFxLevel("simple");
                onClose();
              }}
            >
              Bytt til Enkel
            </Button>
          </div>
        </div>
      )}
      <SpotifyControl compact />
    </Sheet>
  );
}
