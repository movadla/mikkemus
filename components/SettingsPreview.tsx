"use client";

import { useState } from "react";
import { FX_LABELS, fxFlags, type FxLevel } from "@/lib/fxLevel";
import { resolveTheme, type Theme, type ThemeChoice } from "@/lib/theme";
import { uiSound } from "@/lib/uiSound";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";

const SPARKS = 12;

/** What each level adds, in a line, said from what the level really switches on (see fxFlags). */
function describe(level: FxLevel): string {
  const f = fxFlags(level);
  if (level === "simple") return "Rolig: ingen bevegelse utenom det nødvendige, ingen lyd, og kampen teller ikke i statistikken.";
  if (!f.confetti) return "Kortene før kampen, ellers alt som trengs for å følge den, uten støy.";
  if (!f.bigConfetti) return "Kortene før kampen, lyd og bevegelse for hvert kast, konfetti og pokal ved seier.";
  return "Alt i Party, pluss publikum under en rekke og tyngre konfetti.";
}

/**
 * A card that does what the chosen level does when a dart counts, with a button to try it again. Shows the level, not a description
 * of it: what is moving is what the level switches on.
 */
export function FxPreview({ level }: { level: FxLevel }) {
  const [run, setRun] = useState(0);
  const f = fxFlags(level);
  const moves = level !== "simple";
  const sparks = level === "full" ? SPARKS : level === "party" ? SPARKS / 2 : 0;
  return (
    <div className="fx-demo" aria-label={`Forhåndsvisning: ${FX_LABELS[level]}`}>
      <div className="fx-demo-stage" aria-hidden>
        <div key={run} className={`fx-demo-cell ${moves ? "fx-demo-pop" : ""} ${f.rowShine ? "fx-demo-shine" : ""}`}>
          T20
          {Array.from({ length: sparks }, (_, i) => (
            <i key={i} className="fx-spark" style={{ "--a": `${(360 / sparks) * i}deg`, "--d": `${(i % 3) * 40}ms` } as React.CSSProperties} />
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{describe(level)}</p>
        <div className="mt-2">
          <Button
            onClick={() => {
              setRun((n) => n + 1);
              uiSound("confirm");
            }}
          >
            Prøv
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThemeTile({ theme, label }: { theme: Theme; label: string }) {
  return (
    <figure className="theme-tile" data-theme-scope={theme} style={{ background: "var(--color-bg)", color: "var(--color-cream)" }}>
      <div className="theme-tile-row" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <Avatar name="Lars" size="xs" />
        <span className="flex-1 truncate" style={{ fontWeight: 600 }}>
          Lars
        </span>
        <span className="tabular" style={{ color: "var(--color-teal)", fontWeight: 600 }}>
          1 553
        </span>
      </div>
      <div className="theme-tile-chip" style={{ background: "var(--teal-soft)", color: "var(--color-teal)", boxShadow: "inset 0 0 0 1px var(--teal-ring)" }}>
        Valgt
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

/** The theme as the page will look: one tile for Mørk or Dag, and both side by side for Auto, which is whichever the phone is in. */
export function ThemePreview({ choice }: { choice: ThemeChoice }) {
  const now = resolveTheme(choice);
  return (
    <div className="theme-preview" aria-label="Forhåndsvisning av tema">
      {choice === "auto" ? (
        <>
          <ThemeTile theme="dark" label="Mørk" />
          <ThemeTile theme="light" label="Dag" />
        </>
      ) : (
        <ThemeTile theme={choice} label={choice === "dark" ? "Mørk" : "Dag"} />
      )}
      <p className="theme-preview-note" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
        {choice === "auto" ? `Følger telefonen. Nå: ${now === "dark" ? "Mørk" : "Dag"}.` : choice === "dark" ? "Mørk, som kampene er laget for." : "Dag, for lyse rom."} Karrieren er alltid mørk, som en arena.
      </p>
    </div>
  );
}
