"use client";

import { useEffect, useState } from "react";
import type { StorySlide } from "@/lib/nightStory";

/** The colours of the cards, in turn: each a gradient with the text colour that reads on it. */
const LOOKS: { bg: string; fg: string }[] = [
  { bg: "linear-gradient(160deg,var(--color-gold),#7a5815)", fg: "#1a1508" },
  { bg: "linear-gradient(160deg,var(--color-teal),#124e57)", fg: "#04181b" },
  { bg: "linear-gradient(160deg,var(--color-red),#5c1a10)", fg: "#fff2ee" },
  { bg: "linear-gradient(160deg,var(--color-green),#173323)", fg: "#eaf7ee" },
];

const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The night as a story, like the ones in social media: a few cards with a bar across the top for each. Nothing turns by itself: you
 * go on when you have read the card, with a tap on the right half, the Neste button or the right arrow, and back with the left half,
 * Forrige or the left arrow. After the last one it closes. «Mer» opens the matches behind the card (which match it was, and when), with
 * a link to the match where the card is about one.
 */
export function NightStory({ slides, onClose }: { slides: StorySlide[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [more, setMore] = useState(false);

  const go = (to: number) => {
    setMore(false);
    if (to < 0) setI(0);
    else if (to >= slides.length) onClose();
    else setI(to);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // go reads i and the number of cards; both are in the dependencies that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, slides.length, onClose]);

  const s = slides[i];
  const look = LOOKS[i % LOOKS.length];
  if (!s) return null;
  const last = i === slides.length - 1;
  const hasMore = !!s.more && s.more.lines.length > 0;
  const ctl = "rounded-xl px-4 font-semibold " + FOCUS;
  return (
    <div role="dialog" aria-modal="true" aria-label="Kveldens oppsummering" className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3" style={{ background: "rgba(8,12,9,0.94)" }}>
      <div
        className="relative flex flex-col justify-center overflow-hidden select-none"
        style={{ width: "min(88vw, 340px)", height: "min(70vh, 520px)", borderRadius: 22, padding: "28px 24px", background: look.bg, color: look.fg, transition: "background var(--duration-slow)", cursor: "pointer" }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          go(i + (e.clientX - r.left > r.width / 2 ? 1 : -1));
        }}
      >
        <div className="absolute flex gap-1" style={{ top: 10, left: 10, right: 10 }} aria-hidden>
          {slides.map((_, j) => (
            <i key={j} style={{ flex: 1, height: 3, borderRadius: 2, background: `${look.fg}47`, overflow: "hidden" }}>
              <b style={{ display: "block", height: "100%", background: look.fg, width: j <= i ? "100%" : 0 }} />
            </i>
          ))}
        </div>
        <div key={i} style={{ animation: "story-in var(--duration-slow) var(--ease-standard) both" }}>
          <p style={{ fontSize: "var(--text-micro)", letterSpacing: "0.18em", fontWeight: 600, opacity: 0.85 }}>{s.label}</p>
          <p className="font-display" style={{ fontSize: s.big.length > 6 ? "2.8rem" : "4.6rem", lineHeight: 1.02, margin: "14px 0 10px", wordBreak: "break-word" }}>{s.big}</p>
          <p className="font-display" style={{ fontSize: "var(--text-title)", lineHeight: 1.2 }}>{s.title}</p>
          {s.sub && <p style={{ fontSize: "var(--text-body)", opacity: 0.85, marginTop: 10 }}>{s.sub}</p>}
        </div>
        {more && hasMore && (
          // The matches behind the card. Tapping in here reads, it does not turn the card.
          <div
            className="absolute overflow-y-auto"
            style={{ left: 10, right: 10, bottom: 10, maxHeight: "62%", borderRadius: 14, padding: "12px 14px", background: `color-mix(in srgb, ${look.fg} 16%, transparent)`, color: look.fg }}
            onClick={(e) => e.stopPropagation()}
          >
            <ul className="space-y-2" style={{ fontSize: "var(--text-small)", lineHeight: 1.35 }}>
              {s.more!.lines.map((line, j) => (
                <li key={j}>{line}</li>
              ))}
            </ul>
            {s.more!.matchId && (
              <a href={`/kamp/${encodeURIComponent(s.more!.matchId)}`} className={"inline-block mt-3 underline font-semibold " + FOCUS} style={{ fontSize: "var(--text-small)" }}>
                Åpne kampen
              </a>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2" style={{ width: "min(88vw, 340px)" }}>
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className={ctl} style={{ minHeight: "var(--control)", background: "color-mix(in srgb, var(--light) 12%, transparent)", color: "var(--color-cream)", opacity: i === 0 ? 0.4 : 1 }}>
          Forrige
        </button>
        {hasMore && (
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className={ctl} style={{ minHeight: "var(--control)", background: "color-mix(in srgb, var(--light) 12%, transparent)", color: "var(--color-cream)" }}>
            {more ? "Mindre" : "Mer"}
          </button>
        )}
        <button type="button" onClick={() => go(i + 1)} className={ctl + " flex-1"} style={{ minHeight: "var(--control)", background: "var(--color-teal)", color: "var(--color-bg)" }}>
          {last ? "Ferdig" : "Neste"}
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Lukk"
        className={"absolute rounded-full flex items-center justify-center " + FOCUS}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)", right: 12, width: 44, height: 44, background: "color-mix(in srgb, var(--light) 12%, transparent)", color: "var(--color-cream)", fontSize: "var(--text-title)" }}
      >
        ×
      </button>
    </div>
  );
}
