"use client";

import { useEffect, useRef, useState } from "react";
import {
  RULES_SLIDES,
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
              fontSize: s.length > 2 ? "var(--text-small)" : "var(--text-title)",
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
              style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}
            >
              {r.label}
            </span>
            <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
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
            fontSize: "var(--text-num)",
          }}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

/**
 * How the game is played, in five short slides. Nothing moves on by itself: the reader pages
 * forwards and back with the buttons, the dots, the arrow keys or a swipe, and the last slide's
 * button closes it. Shown the first time a game starts on a device, and from the home screen
 * whenever someone wants it again. «Hopp over» is there on every slide.
 */
export function RulesIntro({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const last = RULES_SLIDES.length - 1;

  function finish() {
    markRulesIntroSeen();
    onDone();
  }
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)));

  const slide = RULES_SLIDES[index];
  const nav = `tactile px-4 rounded-lg font-medium ${FOCUS_RING}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Slik spiller du"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      className="animate-screen-enter fixed inset-0 z-[60] flex flex-col items-center justify-center p-6 outline-none"
      style={{ background: "var(--color-bg)" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") finish();
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <button
        type="button"
        onClick={finish}
        className={`tactile absolute top-4 right-4 px-4 rounded-lg text-sm ${FOCUS_RING}`}
        style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
      >
        Hopp over
      </button>

      <div className="w-full max-w-md text-center">
        <p className="section-label mb-6">SLIK SPILLER DU · {index + 1} AV {RULES_SLIDES.length}</p>
        <div key={slide.id} className="animate-name-swap flex flex-col items-center gap-6" style={{ minHeight: "18rem" }}>
          <Picture slide={slide} />
          <h2 className="font-display" style={{ color: "var(--color-cream)", fontSize: "var(--text-num)" }}>
            {slide.title}
          </h2>
          <p style={{ color: "var(--color-cream)", opacity: 0.85, fontSize: "var(--text-body)", lineHeight: 1.55 }}>{slide.text}</p>
        </div>

        <div className="flex justify-center mt-4" role="group" aria-label="Velg side">
          {RULES_SLIDES.map((s, i) => (
            <button key={s.id} type="button" onClick={() => go(i)} aria-label={`Side ${i + 1}`} aria-current={i === index} className={`flex items-center justify-center ${FOCUS_RING}`} style={{ width: "2.75rem", height: "2.75rem" }}>
              <span className="rounded-full block" style={{ width: i === index ? 22 : 8, height: 8, background: i === index ? "var(--color-teal)" : "var(--color-border)", transition: "width var(--duration-fast) var(--ease-standard)" }} />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className={nav}
            style={{ minHeight: "var(--control-lg)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", opacity: index === 0 ? 0.4 : 1 }}
          >
            ← Tilbake
          </button>
          <button
            type="button"
            onClick={() => (index === last ? finish() : go(index + 1))}
            className={nav}
            style={{ minHeight: "var(--control-lg)", background: "var(--color-teal)", color: "var(--color-bg)" }}
          >
            {index === last ? "Ferdig" : "Neste →"}
          </button>
        </div>
      </div>
    </div>
  );
}
