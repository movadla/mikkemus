"use client";

import { useEffect, useState } from "react";
import {
  RULES_SLIDES,
  RULES_SLIDE_MS,
  markRulesIntroSeen,
  type RulesSlide,
} from "@/lib/rulesIntro";
import { STEPS, STEP_LABELS } from "@/lib/game";
import { Mark } from "./Mark";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** The picture beside each slide's text — drawn with the game's own marks, so it is the game. */
function Picture({ slide }: { slide: RulesSlide }) {
  // The crosses fill in one by one on the slide that is about them.
  const [crosses, setCrosses] = useState(0);
  useEffect(() => {
    if (slide.id !== "kryss") return;
    const timer = setInterval(
      () => setCrosses((c) => (c >= 3 ? 0 : c + 1)),
      900,
    );
    return () => clearInterval(timer);
  }, [slide.id]);

  if (slide.id === "kryss") {
    return (
      <div style={{ width: 112, height: 112 }}>
        <Mark count={crosses} target={3} />
      </div>
    );
  }
  if (slide.id === "mal" || slide.id === "vinner") {
    return (
      <div className="flex flex-wrap justify-center gap-2 max-w-xs" aria-hidden>
        {STEPS.map((s) => (
          <span
            key={s}
            className="rounded-md flex items-center justify-center font-display"
            style={{
              width: 44,
              height: 44,
              background:
                slide.id === "vinner"
                  ? "var(--color-cell-done)"
                  : "var(--color-cell)",
              color: "var(--color-cream)",
              fontSize: s.length > 2 ? "0.8rem" : "1.2rem",
              border: "1px solid var(--color-border)",
            }}
          >
            {STEP_LABELS[s]}
          </span>
        ))}
      </div>
    );
  }
  if (slide.id === "ring") {
    return (
      <div className="flex gap-4" aria-hidden>
        {[
          { label: "D", note: "2 kryss", count: 2 },
          { label: "T", note: "3 kryss", count: 3 },
        ].map((r) => (
          <div key={r.label} className="flex flex-col items-center gap-1">
            <div style={{ width: 84, height: 84 }}>
              <Mark count={r.count} target={3} />
            </div>
            <span
              className="font-display"
              style={{ color: "var(--color-cream)", fontSize: "1.3rem" }}
            >
              {r.label}
            </span>
            <span style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
              {r.note}
            </span>
          </div>
        ))}
      </div>
    );
  }
  // "tur": three darts.
  return (
    <div className="flex gap-2" aria-hidden>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className="rounded-lg flex items-center justify-center font-display"
          style={{
            width: 56,
            height: 56,
            background: "var(--color-green)",
            color: "var(--color-cream)",
            fontSize: "1.5rem",
          }}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

/**
 * How the game is played, in under half a minute: five short slides that move on by themselves,
 * with a way out at every moment. Shown the first time a game starts on a device, and from the
 * home screen whenever someone wants it again.
 *
 */
export function RulesIntro({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);

  function finish() {
    markRulesIntroSeen();
    onDone();
  }

  useEffect(() => {
    if (index >= RULES_SLIDES.length - 1) {
      const end = setTimeout(finish, RULES_SLIDE_MS);
      return () => clearTimeout(end);
    }
    const next = setTimeout(() => setIndex((i) => i + 1), RULES_SLIDE_MS);
    return () => clearTimeout(next);
    // finish is re-created every render and only ever reads stable things; restarting the timer
    // on each render would stop a slide from ever ending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const slide = RULES_SLIDES[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Slik spiller du"
      className="animate-screen-enter fixed inset-0 z-[60] flex flex-col items-center justify-center p-6"
      style={{ background: "var(--color-bg)" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") finish();
      }}
    >
      <button
        type="button"
        onClick={finish}
        className={`tactile absolute top-4 right-4 px-4 rounded-lg text-sm ${FOCUS_RING}`}
        style={{
          minHeight: "2.75rem",
          background: "var(--color-surface)",
          color: "var(--color-cream)",
          border: "1px solid var(--color-border)",
        }}
      >
        Hopp over
      </button>

      <div className="w-full max-w-md text-center">
        <p className="section-label mb-6">SLIK SPILLER DU</p>
        <div
          key={slide.id}
          className="animate-name-swap flex flex-col items-center gap-6"
        >
          <Picture slide={slide} />
          <h2
            className="font-display"
            style={{ color: "var(--color-cream)", fontSize: "1.8rem" }}
          >
            {slide.title}
          </h2>
          <p
            style={{
              color: "var(--color-cream)",
              opacity: 0.85,
              fontSize: "1.05rem",
              lineHeight: 1.55,
            }}
          >
            {slide.text}
          </p>
        </div>
        <div className="flex justify-center gap-2 mt-8" aria-hidden>
          {RULES_SLIDES.map((s, i) => (
            <span
              key={s.id}
              className="rounded-full"
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                background:
                  i <= index ? "var(--color-teal)" : "var(--color-border)",
                transition: "width 200ms",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
