"use client";

import { useEffect, useState } from "react";
import { avatarAccent } from "@/lib/avatarAccent";
import type { Kit } from "@/lib/teamKit";
import { TeamKit } from "./TeamKit";

export type LineupSide = {
  name: string;
  /** The team's shirt; absent for a lone player. */
  kit?: Kit | null;
  /** A lone player's picture, or null for the initial. */
  photo?: string | null;
  isBot?: boolean;
  /** «7 seire på 12 kamper», or nothing for someone who has not played yet. */
  record?: string;
};

const COUNT = ["3", "2", "1", "Kast!"];
const STEP_MS = 650;

/**
 * The line-up before the first dart, as on television: the two sides come in from the left and the
 * right under a «VS», then a count down. Tap anywhere to go straight to the board. Four or more
 * sides are listed instead of split in two. Full party only — see lib/fxLevel.ts.
 */
export function LineupIntro({ sides, onDone }: { sides: LineupSide[]; onDone: () => void }) {
  const [count, setCount] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(900);
      for (let i = 0; i < COUNT.length && !cancelled; i++) {
        setCount(i);
        await wait(STEP_MS);
      }
      if (!cancelled) onDone();
    })();
    return () => {
      cancelled = true;
    };
    // The intro runs once for the sides it was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const two = sides.length === 2;
  const picture = (s: LineupSide, size: number) =>
    s.kit ? (
      <TeamKit kit={s.kit} size={size} />
    ) : (
      <span
        className="rounded-full overflow-hidden flex items-center justify-center font-display"
        style={{ width: size * 0.8, height: size * 0.8, border: `3px solid ${avatarAccent(s.name)}`, background: "var(--color-cell)", color: avatarAccent(s.name), fontSize: size * 0.34 }}
        aria-hidden
      >
        {s.isBot ? "🤖" : s.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.photo} alt="" className="w-full h-full object-cover" />
        ) : (
          s.name.charAt(0).toUpperCase()
        )}
      </span>
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Oppstilling"
      onClick={onDone}
      className="fixed inset-0 z-[58] flex items-center justify-center animate-screen-enter"
      style={{ background: "var(--color-bg)" }}
    >
      {two && (
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(75,139,232,0.28) 0 49.5%, transparent 49.5% 50.5%, rgba(224,74,58,0.28) 50.5%)" }} />
      )}
      {two ? (
        <div className="relative w-full grid grid-cols-2 gap-2 px-4">
          {sides.map((s, i) => (
            <div key={s.name} className="flex flex-col items-center gap-2 text-center" style={{ animation: `lineup-in-${i ? "right" : "left"} 600ms cubic-bezier(0.2,0.9,0.3,1.1) both` }}>
              {picture(s, 112)}
              <p className="font-display" style={{ fontSize: "1.5rem", lineHeight: 1.1, color: "var(--color-cream)" }}>
                {s.name}
              </p>
              {s.record && <p style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>{s.record}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="relative w-full px-6 grid gap-3" style={{ maxWidth: "28rem" }}>
          {sides.map((s, i) => (
            <div key={s.name} className="flex items-center gap-3 rounded-xl px-4 py-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", animation: `lineup-in-left 500ms ${i * 90}ms cubic-bezier(0.2,0.9,0.3,1.1) both` }}>
              {picture(s, 52)}
              <span className="font-display flex-1 truncate" style={{ fontSize: "1.3rem" }}>{s.name}</span>
              {s.record && <span style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>{s.record}</span>}
            </div>
          ))}
        </div>
      )}
      {two && (
        <span
          className="absolute flex items-center justify-center font-display rounded-full"
          style={{ left: "50%", top: "42%", width: 56, height: 56, marginLeft: -28, background: "var(--color-gold)", color: "#2b2000", fontSize: "1.3rem", animation: "lineup-vs 450ms 500ms cubic-bezier(0.2,0.9,0.3,1.3) both" }}
        >
          VS
        </span>
      )}
      <p
        key={count}
        aria-live="polite"
        className="absolute font-display"
        style={{ left: 0, right: 0, bottom: "14%", textAlign: "center", fontSize: "2.4rem", color: "var(--color-gold)", animation: count >= 0 ? "lineup-count 380ms ease-out both" : undefined, minHeight: "3rem" }}
      >
        {count >= 0 ? COUNT[count] : ""}
      </p>
      <p className="absolute" style={{ left: 0, right: 0, bottom: "5%", textAlign: "center", color: "var(--color-muted)", fontSize: "0.8rem" }}>
        Trykk for å hoppe over
      </p>
    </div>
  );
}
