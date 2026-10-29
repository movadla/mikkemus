"use client";

import { useEffect, useState } from "react";
import { avatarAccent } from "@/lib/avatarAccent";
import type { Kit } from "@/lib/teamKit";
import { KitStage } from "./TeamKit";
import { Avatar } from "./ui/Avatar";
import { formatOdds } from "@/lib/odds/price";
import { faceSrc, opponentOf } from "@/lib/opponents";

export type LineupSide = {
  name: string;
  /** The team's shirt; absent for a lone player. */
  kit?: Kit | null;
  /** The people in a team, shown on its card. */
  members?: string[];
  /** A lone player's picture, or null for the initial. */
  photo?: string | null;
  isBot?: boolean;
  /** «7 seire på 12 kamper», or nothing for someone who has not played yet. */
  record?: string;
  /** The odds on this side to win, before the first dart. */
  odds?: number;
  /** The chance this side wins, 0 to 1. Shown with the odds. */
  chance?: number;
  /** Mean distance of the darts from the target, in mm: lower is better. */
  med?: number | null;
  /** Share of the darts that counted, in percent. */
  hitPct?: number | null;
  /** Matches won. */
  wins?: number;
  /** Matches played: a win count says nothing without it, so the wins are shown as «2 av 8» and compared as a share. */
  played?: number;
};

/** The bars start to grow once the cards have turned in. */
const GROW_AFTER_MS = 900;

/** The longest the cards wait for the pictures: after this they come in with what has loaded, so the screen is never held back. */
const PICTURES_WAIT_MS = 700;

type Row = { label: string; a: number; b: number; low: boolean; fmt: (n: number) => string; /** What is written for each side when it is not just the number («2 av 8»). */ shown?: [string, string] };

/** The rows both sides have a figure for, so that the two are always compared on the same things. */
function compareRows(sides: LineupSide[]): Row[] {
  if (sides.length !== 2) return [];
  const [x, y] = sides;
  const rows: Row[] = [];
  // The hit share first: it is what the two throw, and what both have a figure for as soon as each has played. Then the distance.
  if (x.hitPct != null && y.hitPct != null) rows.push({ label: "TREFF", a: x.hitPct, b: y.hitPct, low: false, fmt: (n) => `${Math.round(n)} %` });
  if (x.med && y.med) rows.push({ label: "MED", a: x.med, b: y.med, low: true, fmt: (n) => `${Math.round(n)} mm` });
  // Wins only with the matches they are out of, and compared as a share of them: a count of wins alone says nothing.
  if (x.wins !== undefined && y.wins !== undefined && x.played && y.played) {
    rows.push({ label: "SEIRE", a: (x.wins / x.played) * 100, b: (y.wins / y.played) * 100, low: false, fmt: (n) => `${Math.round(n)} %`, shown: [`${x.wins} av ${x.played}`, `${y.wins} av ${y.played}`] });
  }
  if (x.odds !== undefined && y.odds !== undefined) rows.push({ label: "ODDS", a: x.odds, b: y.odds, low: true, fmt: formatOdds });
  return rows;
}

/** How much of the two bars each side gets: the better the figure, the longer. */
const share = (r: Row, v: number) => (r.low ? 1 / v / (1 / r.a + 1 / r.b) : r.a + r.b === 0 ? 0.5 : v / (r.a + r.b));

/**
 * The line-up before the first dart, as on television: each side comes in as a foil card from the left
 * and the right under a «VS», and their figures grow towards each other bar by bar. It stays up until
 * «Fortsett» is pressed, so the figures can be read for as long as it takes, and then the board is there: there is no count down.
 * Three or more sides are listed instead of split in two. Every level but Enkel — see lib/fxLevel.ts.
 */
export function LineupIntro({ sides, onDone }: { sides: LineupSide[]; onDone: () => void }) {
  const [grow, setGrow] = useState(false);
  // The cards come in once the faces are loaded and decoded (or after a short wait), so they never turn in empty and then jump to the finished card.
  const [ready, setReady] = useState(false);
  const rows = compareRows(sides);

  useEffect(() => {
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const srcs = sides.map((s) => (s.kit ? null : s.photo ?? (s.isBot ? faceSrc(opponentOf(s.name).face) : null))).filter((x): x is string => !!x);
    const timer = setTimeout(go, PICTURES_WAIT_MS);
    Promise.all(
      srcs.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      }),
    ).then(() => {
      clearTimeout(timer);
      go();
    });
    return () => clearTimeout(timer);
    // Once, for the sides the intro was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setGrow(true), rows.length > 0 ? GROW_AFTER_MS : 0);
    return () => clearTimeout(t);
    // The bars grow once, after the cards are in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const two = sides.length === 2;
  const sideAccent = (x: LineupSide) => (x.kit ? x.kit.primary : avatarAccent(x.name));
  // A person in the one frame of the app, large; a team as its shirt on a stage, with the people under its name.
  const picture = (s: LineupSide, size: number) =>
    s.kit ? <KitStage kit={s.kit} size={size} /> : <Avatar name={s.name} photo={s.photo} px={size} bot={s.isBot} />;

  const card = (s: LineupSide, i: number) => {
    // The card is washed in the colour that is theirs (a team's own shirt colour), so two cards side by side are two people and not one design twice.
    const accent = s.kit ? s.kit.primary : avatarAccent(s.name);
    return (
      <div
        key={s.name}
        className="edge relative rounded-2xl overflow-hidden flex flex-col items-center text-center px-2 pt-3 pb-3"
        style={{
          aspectRatio: "0.72",
          "--edge-fill-image": `linear-gradient(165deg, color-mix(in srgb, ${accent} 34%, var(--color-panel)) 0%, var(--color-panel) 72%)`,
          "--edge-accent": accent,
          boxShadow: "var(--elevation-3)",
          animation: ready ? `foil-in 420ms ${i * 90}ms cubic-bezier(0.2,0.8,0.2,1) both` : "none",
          opacity: ready ? undefined : 0,
          isolation: "isolate",
        } as React.CSSProperties}
      >
        {s.chance !== undefined && (
          <span className="absolute font-display" style={{ left: 10, top: 8, color: "var(--color-gold-strong)", fontSize: "var(--text-num)", lineHeight: 1 }}>
            {Math.round(s.chance * 100)}
            <small style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "var(--text-micro)", letterSpacing: "0.14em", color: "var(--color-muted)" }}>SJANSE</small>
          </span>
        )}
        <div className={s.chance !== undefined ? "mt-8" : "mt-4"}>{picture(s, s.kit ? 104 : 112)}</div>
        <p className="font-display mt-3 w-full truncate" style={{ fontSize: "var(--text-num)", lineHeight: 1.05, color: "var(--color-cream)", letterSpacing: "0.02em", textShadow: "var(--shadow-text)" }}>
          {s.name}
        </p>
        {s.members && s.members.length > 0 && (
          <p className="w-full truncate" style={{ color: "var(--color-text-2)", fontSize: "var(--text-micro)" }}>
            {s.members.join(" og ")}
          </p>
        )}
        {s.record && <p className="mt-auto" style={{ color: "var(--color-text-2)", fontSize: "var(--text-micro)" }}>{s.record}</p>}
        <span aria-hidden className="foil-sheen" />
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Oppstilling"
      className="fixed inset-0 z-[58] flex items-center justify-center animate-screen-enter"
      style={{ background: "var(--color-bg)" }}
    >
      {two && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(100deg, color-mix(in srgb, ${sideAccent(sides[0])} 22%, transparent) 0 49.5%, transparent 49.5% 50.5%, color-mix(in srgb, ${sideAccent(sides[1])} 22%, transparent) 50.5%)` }}
        />
      )}
      {two ? (
        <div className="relative w-full px-4 flex flex-col items-center gap-5" style={{ maxWidth: "30rem", marginTop: "-6%" }}>
          <div className="relative w-full grid grid-cols-2 gap-3">
            {sides.map(card)}
            <span
              className="absolute flex items-center justify-center font-display rounded-full"
              style={{ left: "50%", top: "50%", width: 54, height: 54, marginLeft: -27, marginTop: -27, background: "var(--color-gold)", color: "#2b2000", fontSize: "var(--text-title)", animation: ready ? "lineup-vs 350ms 350ms cubic-bezier(0.2,0.9,0.3,1.3) both" : "none", opacity: ready ? undefined : 0, zIndex: 5, border: "3px solid var(--color-bg)" }}
            >
              VS
            </span>
          </div>
          {rows.length > 0 && (
            <div className="w-full grid gap-3" style={{ animation: ready ? "lineup-count 300ms 600ms ease-out both" : "none", opacity: ready ? undefined : 0 }}>
              {rows.map((r, i) => {
                const aBetter = r.low ? r.a < r.b : r.a > r.b;
                const tie = r.a === r.b;
                const bar = (v: number, left: boolean, better: boolean) => (
                  <div className="flex" style={{ height: 14, borderRadius: 7, background: "color-mix(in srgb, var(--shade) 30%, transparent)", overflow: "hidden", justifyContent: left ? "flex-end" : "flex-start" }}>
                    <i
                      style={{ display: "block", height: "100%", borderRadius: 7, width: grow ? `${Math.min(100, share(r, v) * 170)}%` : 0, transition: `width 800ms ${i * 220}ms cubic-bezier(0.2,0.9,0.2,1)`, background: better && !tie ? "var(--color-gold-strong)" : "var(--color-muted)" }}
                    />
                  </div>
                );
                return (
                  <div key={r.label} className="grid items-center gap-2" style={{ gridTemplateColumns: "3.9rem 1fr 3rem 1fr 3.9rem" }}>
                    <span className="font-display tabular" style={{ fontSize: "var(--text-body)", color: "var(--color-cream)" }}>{r.shown ? r.shown[0] : r.fmt(r.a)}</span>
                    {bar(r.a, true, aBetter)}
                    <span style={{ textAlign: "center", fontSize: "var(--text-micro)", letterSpacing: "0.12em", color: "var(--color-muted)" }}>{r.label}</span>
                    {bar(r.b, false, !aBetter)}
                    <span className="font-display tabular" style={{ fontSize: "var(--text-body)", color: "var(--color-cream)", textAlign: "right" }}>{r.shown ? r.shown[1] : r.fmt(r.b)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full px-6 grid gap-3" style={{ maxWidth: "28rem" }}>
          {sides.map((s, i) => (
            <div key={s.name} className="flex items-center gap-3 rounded-xl px-4 py-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", animation: `lineup-in-left 500ms ${i * 90}ms cubic-bezier(0.2,0.9,0.3,1.1) both` }}>
              {picture(s, s.kit ? 52 : 52)}
              <span className="font-display flex-1 truncate" style={{ fontSize: "var(--text-title)" }}>{s.name}</span>
              {s.record && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{s.record}</span>}
              {s.odds !== undefined && <span className="font-display" style={{ color: "var(--color-gold)" }}>{formatOdds(s.odds)}</span>}
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        autoFocus
        onClick={onDone}
        className="glossy absolute rounded-full font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]"
        style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", left: "50%", bottom: "7%", transform: "translateX(-50%)", minHeight: "var(--control-lg)", padding: "0 2.5rem", fontSize: "var(--text-title)", animation: "lineup-count 300ms 500ms ease-out both" } as React.CSSProperties}
      >
        Fortsett
      </button>
    </div>
  );
}
