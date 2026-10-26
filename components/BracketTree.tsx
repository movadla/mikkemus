"use client";

import { Fragment, useEffect, useRef } from "react";
import { bracketRounds, bronzeMatch, isHouseName, placeholderLabel, seedOf } from "@/lib/knockout";
import type { Tournament, TournamentMatch } from "@/lib/tournament";
import { TrophyIcon } from "./icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type Metrics = { w: number; h: number; pitch: number; gap: number; top: number; font: string; small: string };
const NORMAL: Metrics = { w: 160, h: 54, pitch: 68, gap: 30, top: 34, font: "0.8rem", small: "0.62rem" };
const LARGE: Metrics = { w: 250, h: 70, pitch: 92, gap: 48, top: 44, font: "1.15rem", small: "0.8rem" };

/**
 * The whole knockout as a tree: a column for each round, a box for each match, and a line from every match into the one its winner
 * goes to. Every place is drawn from the start (a name where it is known, "Vinner Kvartfinale 2" where it is not), so the tree is
 * the same shape before the first match and after the last, and what changes is who is on it. The match to play next is lit, and
 * the match that was just decided pulses, with the winner sliding into the next box.
 */
export function BracketTree({
  tournament,
  nextId = null,
  justDecidedId = null,
  onSelect,
  large = false,
}: {
  tournament: Tournament;
  nextId?: string | null;
  justDecidedId?: string | null;
  onSelect?: (match: TournamentMatch) => void;
  large?: boolean;
}) {
  const m = large ? LARGE : NORMAL;
  const rounds = bracketRounds(tournament);
  const bronze = bronzeMatch(tournament);
  const first = rounds[0]?.matches.length ?? 1;
  const total = first * m.pitch;
  const colX = (ci: number) => ci * (m.w + m.gap);
  const width = (rounds.length + 1) * (m.w + m.gap) - m.gap;
  const height = m.top + total + (bronze ? m.h + 44 : 0);
  const centerY = (ci: number, i: number) => {
    const pitch = total / rounds[ci].matches.length;
    return m.top + (i + 0.5) * pitch;
  };
  const just = justDecidedId ? tournament.matches.find((x) => x.id === justDecidedId) : undefined;
  const scroller = useRef<HTMLDivElement>(null);
  const focus = useRef<HTMLDivElement>(null);

  // The match to play next is brought into view, so a long bracket opens where the action is.
  useEffect(() => {
    const box = scroller.current;
    const el = focus.current;
    if (!box || !el) return;
    const target = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [nextId, justDecidedId]);

  const side = (match: TournamentMatch, which: "A" | "B") => {
    const name = which === "A" ? match.participantA : match.participantB;
    const won = !!match.winner && match.winner === name && !match.isBye;
    const lost = !!match.winner && !!name && match.winner !== name;
    const seed = name ? seedOf(tournament, name) : null;
    const darts = name ? match.stats?.[name]?.darts : undefined;
    const advanced = !!just && !!name && (match.feedA === just.id || match.feedB === just.id) && name === just.winner;
    const house = name ? isHouseName(tournament, name) : false;
    return (
      <div
        key={which}
        className={`flex items-center gap-1.5 px-2 flex-1 min-w-0 ${advanced ? "bt-in" : ""}`}
        style={{
          background: won ? "var(--teal-soft, rgba(52,195,210,0.16))" : "transparent",
          color: won ? "var(--color-cream)" : lost ? "var(--color-muted)" : "var(--color-cream)",
          fontWeight: won ? 700 : 500,
          fontSize: m.font,
          opacity: lost ? 0.6 : 1,
          borderTop: which === "B" ? "1px solid var(--color-border)" : undefined,
        }}
      >
        {name ? (
          <>
            {seed !== null && <span style={{ color: "var(--color-muted)", fontSize: m.small, minWidth: "1.3rem" }}>#{seed}</span>}
            <span className="truncate flex-1" style={{ color: house && !lost ? "var(--color-teal-strong)" : undefined }}>
              {name}
            </span>
            {darts !== undefined && (
              <span className="tabular" style={{ color: "var(--color-muted)", fontSize: m.small }}>
                {darts}
              </span>
            )}
          </>
        ) : (
          <span className="truncate" style={{ fontStyle: "italic", color: "var(--color-muted)", fontSize: m.small }}>
            {placeholderLabel(tournament, match, which)}
          </span>
        )}
      </div>
    );
  };

  const tie = (match: TournamentMatch, left: number, top: number) => {
    const isNext = match.id === nextId;
    const isJust = match.id === justDecidedId;
    const decided = !!match.winner;
    const content = (
      <>
        {side(match, "A")}
        {side(match, "B")}
        {isNext && (
          <span className="absolute font-bold" style={{ top: -9, right: 8, background: "var(--color-teal)", color: "var(--color-bg)", fontSize: "0.6rem", letterSpacing: "0.1em", padding: "1px 6px", borderRadius: 4 }}>
            NESTE
          </span>
        )}
        {match.isBye && (
          <span className="absolute" style={{ top: -8, left: 8, background: "var(--color-surface)", padding: "0 4px", color: "var(--color-muted)", fontSize: "0.55rem", letterSpacing: "0.08em" }}>
            WALKOVER
          </span>
        )}
        {match.simulated && (
          <span className="absolute" style={{ top: -8, left: 8, background: "var(--color-surface)", padding: "0 4px", color: "var(--color-muted)", fontSize: "0.55rem", letterSpacing: "0.08em" }}>
            SPILT ANNET STED
          </span>
        )}
      </>
    );
    const style: React.CSSProperties = {
      position: "absolute",
      left,
      top,
      width: m.w,
      height: m.h,
      display: "flex",
      flexDirection: "column",
      textAlign: "left",
      borderRadius: 8,
      background: "var(--color-surface)",
      border: isNext ? "2px solid var(--color-teal)" : "1px solid var(--color-border)",
      boxShadow: isNext ? "0 0 18px rgba(52,195,210,0.35)" : undefined,
      opacity: decided && !isJust ? 0.95 : 1,
    };
        const selectable = !!onSelect && !!match.participantA && !!match.participantB;
    return (
      <div key={match.id} ref={isNext ? focus : undefined} style={{ position: "absolute", left, top, width: m.w, height: m.h }}>
        {selectable ? (
          <button type="button" onClick={() => onSelect!(match)} aria-label={`${[match.participantA, match.participantB].join(" mot ")}`} style={{ ...style, left: 0, top: 0, cursor: "pointer", padding: 0 }} className={`${isJust ? "bt-pop" : ""} ${FOCUS_RING}`}>
            {content}
          </button>
        ) : (
          <div className={isJust ? "bt-pop" : undefined} style={{ ...style, left: 0, top: 0 }}>
            {content}
          </div>
        )}
      </div>
    );
  };

  const lines: React.ReactNode[] = [];
  rounds.forEach((r, ci) => {
    if (ci === rounds.length - 1) return;
    for (let k = 0; k < r.matches.length / 2; k++) {
      const a = r.matches[2 * k];
      const b = r.matches[2 * k + 1];
      const x0 = colX(ci) + m.w;
      const xm = x0 + m.gap / 2;
      const xn = x0 + m.gap;
      const y1 = centerY(ci, 2 * k);
      const y2 = centerY(ci, 2 * k + 1);
      const ym = (y1 + y2) / 2;
      const on = (x: TournamentMatch) => (x.winner ? "var(--color-teal)" : "var(--color-border)");
      const hot = (x: TournamentMatch) => (x.id === justDecidedId ? 3 : x.winner ? 2 : 1.5);
      lines.push(
        <Fragment key={`${ci}-${k}`}>
          <path d={`M${x0},${y1} H${xm} V${ym}`} stroke={on(a)} strokeWidth={hot(a)} fill="none" />
          <path d={`M${x0},${y2} H${xm} V${ym}`} stroke={on(b)} strokeWidth={hot(b)} fill="none" />
          <path d={`M${xm},${ym} H${xn}`} stroke={a.winner && b.winner ? "var(--color-teal)" : "var(--color-border)"} strokeWidth={a.winner && b.winner ? 2 : 1.5} fill="none" />
        </Fragment>,
      );
    }
  });
  const lastCol = rounds.length - 1;
  const final = rounds[lastCol]?.matches[0];
  const finalY = centerY(lastCol, 0);
  if (final) {
    lines.push(<path key="cup" d={`M${colX(lastCol) + m.w},${finalY} H${colX(lastCol + 1)}`} stroke={final.winner ? "var(--color-gold)" : "var(--color-border)"} strokeWidth={final.winner ? 2.5 : 1.5} fill="none" />);
  }

  return (
    <div ref={scroller} className="overflow-x-auto" style={{ paddingBottom: 8 }}>
      <div className="relative" style={{ width, height, minWidth: width }} role="group" aria-label="Utslagsbrakett">
        {rounds.map((r, ci) => (
          <div key={r.size} className="absolute text-center section-label" style={{ left: colX(ci), top: 0, width: m.w, borderBottom: "1px solid var(--color-border)", paddingBottom: 6 }}>
            {r.label.toUpperCase()}
          </div>
        ))}
        <div className="absolute text-center section-label" style={{ left: colX(rounds.length), top: 0, width: m.w, borderBottom: "1px solid var(--color-gold)", paddingBottom: 6, color: "var(--color-gold)" }}>
          MESTER
        </div>
        <svg width={width} height={height} className="absolute left-0 top-0 pointer-events-none" aria-hidden>
          {lines}
        </svg>
        {rounds.map((r, ci) => r.matches.map((match, i) => tie(match, colX(ci), centerY(ci, i) - m.h / 2)))}
        <div
          className="absolute flex flex-col items-center justify-center gap-1 text-center"
          style={{ left: colX(rounds.length), top: finalY - m.h * 0.75, width: m.w, height: m.h * 1.5, borderRadius: 10, border: `1px ${tournament.winner ? "solid" : "dashed"} var(--color-gold)`, color: "var(--color-gold)", background: tournament.winner ? "rgba(217,174,79,0.1)" : "transparent" }}
        >
          <TrophyIcon className={large ? "w-9 h-9" : "w-6 h-6"} />
          <span className="font-display w-full px-2" style={{ lineHeight: 1.1, fontSize: large ? "1.4rem" : "0.95rem", color: tournament.winner ? "var(--color-cream)" : "var(--color-gold)" }}>
            {tournament.winner ?? tournament.cup?.trophy ?? "Pokalen"}
          </span>
        </div>
        {bronze && (
          <>
            <div className="absolute section-label" style={{ left: colX(lastCol), top: m.top + total + 6, width: m.w, color: "var(--color-muted)" }}>
              BRONSEFINALE
            </div>
            {tie(bronze, colX(lastCol), m.top + total + 30)}
          </>
        )}
      </div>
    </div>
  );
}
