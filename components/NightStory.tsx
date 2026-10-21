"use client";

import { useEffect, useState } from "react";
import type { StorySlide } from "@/lib/nightStory";

const SLIDE_MS = 2800;

/** The colours of the cards, in turn: each a gradient with the text colour that reads on it. */
const LOOKS: { bg: string; fg: string }[] = [
  { bg: "linear-gradient(160deg,#d9ae4f,#7a5815)", fg: "#1a1508" },
  { bg: "linear-gradient(160deg,#34c3d2,#124e57)", fg: "#04181b" },
  { bg: "linear-gradient(160deg,#e25a45,#5c1a10)", fg: "#fff2ee" },
  { bg: "linear-gradient(160deg,#58b072,#173323)", fg: "#eaf7ee" },
];

/**
 * The night as a story, like the ones in social media: a few cards that turn themselves, with a bar
 * across the top for each. Tap the right half for the next card and the left half for the one before;
 * after the last one it closes. Plays on any phone from the night's page.
 */
export function NightStory({ slides, onClose }: { slides: StorySlide[]; onClose: () => void }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      if (i >= slides.length - 1) onClose();
      else setI(i + 1);
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, slides.length, onClose]);

  const go = (to: number) => {
    if (to < 0) setI(0);
    else if (to >= slides.length) onClose();
    else setI(to);
  };

  const s = slides[i];
  const look = LOOKS[i % LOOKS.length];
  if (!s) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Kveldens oppsummering" className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: "rgba(8,12,9,0.94)" }}>
      <div
        className="relative flex flex-col justify-center overflow-hidden select-none"
        style={{ width: "min(88vw, 340px)", height: "min(78vh, 560px)", borderRadius: 22, padding: "28px 24px", background: look.bg, color: look.fg, transition: "background 500ms", cursor: "pointer" }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          go(i + (e.clientX - r.left > r.width / 2 ? 1 : -1));
        }}
      >
        <div className="absolute flex gap-1" style={{ top: 10, left: 10, right: 10 }} aria-hidden>
          {slides.map((_, j) => (
            <i key={j} style={{ flex: 1, height: 3, borderRadius: 2, background: `${look.fg}47`, overflow: "hidden" }}>
              <b
                key={j === i ? `cur-${i}` : `s-${j}`}
                style={{ display: "block", height: "100%", background: look.fg, width: j < i ? "100%" : 0, animation: j === i ? `story-seg ${SLIDE_MS}ms linear both` : undefined }}
              />
            </i>
          ))}
        </div>
        <div key={i} style={{ animation: "story-in 600ms cubic-bezier(0.2,0.9,0.2,1) both" }}>
          <p style={{ fontSize: "0.72rem", letterSpacing: "0.18em", fontWeight: 600, opacity: 0.85 }}>{s.label}</p>
          <p className="font-display" style={{ fontSize: s.big.length > 6 ? "2.8rem" : "4.6rem", lineHeight: 1.02, margin: "14px 0 10px", wordBreak: "break-word" }}>{s.big}</p>
          <p className="font-display" style={{ fontSize: "1.4rem", lineHeight: 1.2 }}>{s.title}</p>
          {s.sub && <p style={{ fontSize: "0.9rem", opacity: 0.85, marginTop: 10 }}>{s.sub}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Lukk"
        className="absolute rounded-full flex items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)", right: 12, width: 44, height: 44, background: "rgba(255,255,255,0.12)", color: "var(--color-cream)", fontSize: "1.3rem" }}
      >
        ×
      </button>
    </div>
  );
}
