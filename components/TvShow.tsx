"use client";

import { useEffect, useState } from "react";
import { cupColor } from "@/lib/botCup";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import type { LiveShow } from "@/lib/liveMatch";
import { CupBanner } from "./CupBanner";
import { Trophy } from "./Trophy";
import { TvFrame } from "./TvFrame";
import { CupEmblem } from "./ui/CupEmblem";
import { TrophyIcon } from "./icons";

type Draw = Extract<LiveShow, { kind: "draw" }>;
type Champion = Extract<LiveShow, { kind: "champion" }>;

const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The draw as a broadcast: the cup's title card across the top, the pair being drawn large on a stage in the cup's colour, and the
 * pairs already drawn gathered below. The pace is the phone's (a pair at a time, held to a few seconds for the whole draw), and it
 * starts again whenever the draw is made again.
 */
function TvDraw({ show }: { show: Draw }) {
  const [revealed, setRevealed] = useState(0);
  const total = show.pairs.length;
  const colour = cupColor(show.cup?.kind);

  useEffect(() => {
    if (calm()) {
      const t = setTimeout(() => setRevealed(total), 0);
      return () => clearTimeout(t);
    }
    // A pair every 1.1 s for a small cup, and a cup of 128 is held to eight seconds all told.
    const step = Math.min(1100, 8000 / Math.max(1, total));
    const timers = Array.from({ length: total }, (_, i) => setTimeout(() => setRevealed(i + 1), step * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [total]);

  const drawing = revealed < total;
  const now = revealed > 0 ? show.pairs[revealed - 1] : null;
  return (
    <TvFrame label="Trekning" className="items-center gap-8 px-12 py-16">
      <h1 className="sr-only">Trekning: {show.title}</h1>
      <div className="w-full" style={{ maxWidth: "70rem" }}>
        {show.cup ? <CupBanner cup={show.cup} name={show.title} large /> : <p className="font-display mb-4" style={{ color: "var(--color-cream)", fontSize: "var(--text-num)" }}>{show.title}</p>}
        {drawing && (
          <div
            className="draw-stage text-center mb-6"
            style={{ "--draw": colour, borderRadius: "var(--radius-l)", background: `linear-gradient(180deg, color-mix(in srgb, ${colour} 20%, var(--color-surface)), var(--color-surface))`, border: `1px solid color-mix(in srgb, ${colour} 55%, var(--color-border))`, padding: "3rem 2rem" } as React.CSSProperties}
            aria-live="polite"
          >
            <div className="flex items-center justify-center gap-6" style={{ minHeight: "9rem" }}>
              {now ? (
                <div key={revealed} className="draw-stage-pair flex items-center justify-center gap-6 w-full">
                  <span className="draw-from-left font-display flex-1 min-w-0 truncate text-right" style={{ color: "var(--color-cream)", fontSize: "4.5rem", lineHeight: 1.05 }}>
                    {now.a ?? "Walkover"}
                  </span>
                  <span className="draw-pop font-display" style={{ color: colour, fontSize: "var(--text-num)" }}>
                    mot
                  </span>
                  <span className="draw-from-right font-display flex-1 min-w-0 truncate text-left" style={{ color: "var(--color-cream)", fontSize: "4.5rem", lineHeight: 1.05 }}>
                    {now.b ?? "Walkover"}
                  </span>
                </div>
              ) : (
                <span className="draw-pulse" style={{ color: colour }}>
                  {show.cup ? <CupEmblem kind={show.cup.kind} className="w-24 h-24" /> : <TrophyIcon className="w-24 h-24" />}
                </span>
              )}
            </div>
            <div className="mt-6 rounded-full overflow-hidden" style={{ height: "0.4rem", background: "var(--color-cell)" }} aria-hidden>
              <div style={{ width: `${(revealed / total) * 100}%`, height: "100%", background: colour, transition: "width var(--pull)" }} />
            </div>
          </div>
        )}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(22rem, 1fr))" }}>
          {show.pairs.map((p, i) => (
            <div
              key={`${show.key}-${i}`}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${i === revealed - 1 && drawing ? "draw-flash" : ""}`}
              style={{ "--draw": colour, background: "var(--color-panel)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: "var(--text-title)", opacity: i < revealed ? 1 : 0, transition: "opacity var(--pull)" } as React.CSSProperties}
            >
              <span className="flex-1 min-w-0 truncate text-right">{p.a ?? "Walkover"}</span>
              <span className="font-display" style={{ color: "var(--color-muted)" }}>
                mot
              </span>
              <span className="flex-1 min-w-0 truncate">{p.b ?? "Walkover"}</span>
            </div>
          ))}
        </div>
      </div>
    </TvFrame>
  );
}

/** The champion as a scene: the trophy under the cup's own light, the name large in gold, and the prizes and the podium beside it. */
function TvChampion({ show }: { show: Champion }) {
  const level = useFxLevel();
  const fx = fxFlags(level);
  const colour = cupColor(show.cup?.kind);
  return (
    <TvFrame label="Mester" className="items-center justify-center px-12 py-16">
      <h1 className="sr-only">Mester: {show.winner}</h1>
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: "70vh", background: `radial-gradient(60% 80% at 50% 0%, color-mix(in srgb, ${colour} 34%, transparent), transparent 100%)` }} aria-hidden />
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: "0.4rem", background: colour }} aria-hidden />
      <div className="relative z-10 flex flex-col items-center text-center w-full" style={{ maxWidth: "70rem" }}>
        <p className="section-label inline-flex items-center gap-3" style={{ color: colour, fontSize: "var(--text-body)" }}>
          {show.cup && <CupEmblem kind={show.cup.kind} className="w-6 h-6" />}
          {show.title.toUpperCase()} · MESTER
        </p>
        {fx.trophy && (
          <div className="mt-2">
            <Trophy cannons={fx.confetti} />
          </div>
        )}
        <p className="font-display animate-winner-pop" style={{ color: "var(--color-gold)", fontSize: "7rem", lineHeight: 1.05 }}>
          {show.winner}
        </p>
        {show.trophy && (
          <p style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>vinner {show.trophy}</p>
        )}
        {show.members && show.members.length > 0 && (
          <p style={{ color: "var(--color-muted)", fontSize: "var(--text-title)" }}>{show.members.join(" og ")}</p>
        )}
        <div className="grid gap-6 mt-10 w-full" style={{ gridTemplateColumns: show.podium && show.prizes.length > 0 ? "1fr 1fr" : "1fr" }}>
          {show.podium && show.podium.length > 0 && (
            <ol className="card text-left space-y-2" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }} aria-label="Pallen">
              {show.podium.map((name, i) => (
                <li key={name} className="flex items-baseline gap-3">
                  <span className="font-display tabular" style={{ color: ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"][i] }}>
                    {i + 1}.
                  </span>
                  {name}
                </li>
              ))}
            </ol>
          )}
          {show.prizes.length > 0 && (
            <div className="card text-left space-y-2" aria-label="Utmerkelser">
              {show.prizes.map((a) => (
                <div key={a.title} className="flex items-baseline justify-between gap-4">
                  <span style={{ color: "var(--color-muted)", fontSize: "var(--text-body)" }}>{a.title}</span>
                  <span className="text-right" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)" }}>
                    <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>{a.name}</span>
                    <span className="block" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                      {a.detail}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

/** What the big screen shows when the phone sends a draw or a champion instead of a match. */
export function TvShow({ show }: { show: LiveShow }) {
  // A new draw (its key) is a new component, so it plays from the start; the same draw sent again after a swap keeps its pace.
  return show.kind === "draw" ? <TvDraw key={show.key} show={show} /> : <TvChampion show={show} />;
}
