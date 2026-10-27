"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { avatarAccent } from "@/lib/avatarAccent";
import { cupColor } from "@/lib/botCup";
import { bracketRounds, bronzeMatch, isHouseName, placeholderLabel, routeOf, seedOf } from "@/lib/knockout";
import type { Tournament, TournamentMatch } from "@/lib/tournament";
import { useRoster } from "@/lib/storage";
import { MinusIcon, PlusIcon, TrophyIcon } from "./icons";
import { Avatar } from "./ui/Avatar";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type Metrics = { w: number; h: number; pitch: number; gap: number; top: number; font: string; small: string };
const NORMAL: Metrics = { w: 160, h: 54, pitch: 68, gap: 30, top: 34, font: "var(--text-small)", small: "var(--text-micro)" };
const LARGE: Metrics = { w: 250, h: 70, pitch: 92, gap: 48, top: 44, font: "var(--text-title)", small: "var(--text-small)" };

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
  const accent = cupColor(tournament.cup?.kind);
  const just = justDecidedId ? tournament.matches.find((x) => x.id === justDecidedId) : undefined;
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));
  // The row of names to follow is out of the way until it is asked for.
  const [followOpen, setFollowOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const focus = useRef<HTMLDivElement>(null);
  // Zoom: a tree of five or more rounds (32 and up) starts small enough to be seen whole, and can be pinched or stepped.
  const [scale, setScale] = useState(rounds.length >= 5 ? 0.5 : 1);
  // Whose road lights up (a tap on a name above the tree), and the colour it is drawn in.
  const [follow, setFollow] = useState<string | null>(null);
  const road = follow ? routeOf(tournament, follow) : null;
  const roadColour = follow ? avatarAccent(follow) : "var(--color-teal)";
  const followable = !large ? tournament.participants.filter((p) => !p.isBot).slice(0, 16) : [];
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const zoomable = !large;
  const zoomTo = (next: number) => setScale(Math.min(1.6, Math.max(0.3, Math.round(next * 100) / 100)));
  const fit = () => {
    const box = scroller.current;
    if (box) zoomTo(Math.min(1, box.clientWidth / width));
  };
  const pointerDistance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  // The match to play next is brought into view, so a long bracket opens where the action is.
  useEffect(() => {
    const box = scroller.current;
    const el = focus.current;
    if (!box || !el) return;
    const target = el.offsetLeft * scale - (box.clientWidth - el.offsetWidth * scale) / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [nextId, justDecidedId, scale]);

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
          background: won ? "var(--teal-soft, color-mix(in srgb, var(--color-teal) 16%, transparent))" : "transparent",
          color: won ? "var(--color-cream)" : lost ? "var(--color-muted)" : "var(--color-cream)",
          fontWeight: won ? 700 : 500,
          fontSize: m.font,
          opacity: lost ? 0.6 : 1,
          borderTop: which === "B" ? "1px solid var(--color-border)" : undefined,
        }}
      >
        {name ? (
          <>
            {large && <Avatar name={name} photo={photos.get(name)} px={Math.round(m.h * 0.38)} />}
            <span className="truncate flex-1" style={{ color: house && !lost ? "var(--color-teal-strong)" : undefined }}>
              {name}
              {seed !== null && <span style={{ color: "var(--color-muted)", fontSize: m.small, fontWeight: 400 }}> ({seed})</span>}
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
          <span className="absolute font-bold" style={{ top: -9, right: 8, background: "var(--color-teal)", color: "var(--color-bg)", fontSize: "var(--text-micro)", letterSpacing: "0.1em", padding: "1px 6px", borderRadius: 4 }}>
            NESTE
          </span>
        )}
        {match.isBye && (
          <span className="absolute" style={{ top: -8, left: 8, background: "var(--color-surface)", padding: "0 4px", color: "var(--color-muted)", fontSize: "var(--text-micro)", letterSpacing: "0.08em" }}>
            WALKOVER
          </span>
        )}
        {match.simulated && (
          <span className="absolute" style={{ top: -8, left: 8, background: "var(--color-surface)", padding: "0 4px", color: "var(--color-muted)", fontSize: "var(--text-micro)", letterSpacing: "0.08em" }}>
            AUTO
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
      borderRadius: "var(--radius-s)",
      background: "var(--color-surface)",
      border: road?.has(match.id) ? `2px solid ${roadColour}` : isNext ? "2px solid var(--color-teal)" : "1px solid var(--color-border)",
      boxShadow: isNext ? "var(--elevation-1), 0 0 18px color-mix(in srgb, var(--color-teal) 35%, transparent)" : "var(--elevation-1)",
      opacity: road && !road.has(match.id) ? 0.3 : decided && !isJust ? 0.95 : 1,
      transition: "opacity var(--pull)",
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

  // A line that has been won (or lit) glows in its own colour; one that has not is plain.
  const glow = (colour: string): React.CSSProperties | undefined => (colour && colour !== "var(--color-border)" ? { filter: `drop-shadow(0 0 3px ${colour})` } : undefined);
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
      const onward = rounds[ci + 1]?.matches[k];
      // With a road lit, its lines are drawn in the entrant's colour and the rest step back.
      const lit = (x: TournamentMatch) => !!road && road.has(x.id) && !!onward && road.has(onward.id);
      const on = (x: TournamentMatch) => (lit(x) ? roadColour : road ? "var(--color-border)" : x.winner ? "var(--color-teal)" : "var(--color-border)");
      const hot = (x: TournamentMatch) => (lit(x) ? 3.5 : x.id === justDecidedId ? 3 : x.winner ? 2 : 1.5);
      const joined = lit(a) || lit(b);
      lines.push(
        <Fragment key={`${ci}-${k}`}>
          <path d={`M${x0},${y1} H${xm} V${ym}`} stroke={on(a)} strokeWidth={hot(a)} fill="none" style={glow(on(a))} />
          <path d={`M${x0},${y2} H${xm} V${ym}`} stroke={on(b)} strokeWidth={hot(b)} fill="none" style={glow(on(b))} />
          <path d={`M${xm},${ym} H${xn}`} style={glow(joined ? roadColour : a.winner && b.winner ? "var(--color-teal)" : "")} stroke={joined ? roadColour : road ? "var(--color-border)" : a.winner && b.winner ? "var(--color-teal)" : "var(--color-border)"} strokeWidth={joined ? 3.5 : a.winner && b.winner ? 2 : 1.5} fill="none" />
        </Fragment>,
      );
    }
  });
  const lastCol = rounds.length - 1;
  const final = rounds[lastCol]?.matches[0];
  const finalY = centerY(lastCol, 0);
  if (final) {
    lines.push(<path key="cup" d={`M${colX(lastCol) + m.w},${finalY} H${colX(lastCol + 1)}`} stroke={final.winner ? accent : "var(--color-border)"} strokeWidth={final.winner ? 2.5 : 1.5} fill="none" style={glow(final.winner ? accent : "")} />);
  }

  return (
    <div>
      {followable.length > 1 && followOpen && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2" role="group" aria-label="Følg en spiller">
          <span className="section-label mr-1">FØLG</span>
          {followable.map((p) => {
            const on = follow === p.name;
            return (
              <button
                key={p.name}
                type="button"
                aria-pressed={on}
                onClick={() => setFollow(on ? null : p.name)}
                className={`tactile inline-flex items-center gap-1.5 px-3 ${FOCUS_RING}`}
                style={{ minHeight: "var(--control)", borderRadius: "var(--radius-s)", fontSize: "var(--text-small)", fontWeight: 600, color: "var(--color-cream)", background: on ? `color-mix(in srgb, ${avatarAccent(p.name)} 22%, var(--color-surface))` : "var(--color-surface)", border: `1px solid ${on ? avatarAccent(p.name) : "var(--color-border)"}` }}
              >
                <span aria-hidden className="rounded-full" style={{ width: 8, height: 8, background: avatarAccent(p.name) }} />
                {p.name}
              </button>
            );
          })}
        </div>
      )}
      {zoomable && (
        <div className="flex items-center justify-end gap-2 mb-2">
          {followable.length > 1 && (
            <button type="button" aria-expanded={followOpen} onClick={() => { setFollowOpen((v) => !v); if (followOpen) setFollow(null); }} className={`tactile px-3 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", borderRadius: "var(--radius-pill)", background: followOpen ? "var(--teal-soft)" : "var(--color-surface)", color: followOpen ? "var(--color-teal)" : "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "var(--text-small)" }}>
              Følg
            </button>
          )}
          <button type="button" onClick={fit} className={`tactile px-3 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", borderRadius: "var(--radius-s)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "var(--text-small)" }}>
            Tilpass
          </button>
          <button type="button" aria-label="Zoom ut" onClick={() => zoomTo(scale - 0.2)} className={`tactile flex items-center justify-center ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-s)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
            <MinusIcon className="w-5 h-5" />
          </button>
          <button type="button" aria-label="Zoom inn" onClick={() => zoomTo(scale + 0.2)} className={`tactile flex items-center justify-center ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-s)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      )}
    <div
      ref={scroller}
      className="overflow-x-auto"
      style={{ paddingBottom: 8, touchAction: zoomable ? "pan-x pan-y" : undefined }}
      onPointerDown={(e) => {
        if (!zoomable) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) pinch.current = { dist: pointerDistance(), scale };
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2 && pinch.current && pinch.current.dist > 0) zoomTo(pinch.current.scale * (pointerDistance() / pinch.current.dist));
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
      }}
    >
      <div style={{ width: width * scale, height: height * scale }}>
      <div className="relative" style={{ width, height, minWidth: width, transform: `scale(${scale})`, transformOrigin: "0 0" }} role="group" aria-label="Utslagsbrakett">
        {rounds.map((r, ci) => (
          <div key={r.size} className="absolute text-center section-label" style={{ left: colX(ci), top: 0, width: m.w, borderBottom: "1px solid var(--color-border)", paddingBottom: 6 }}>
            {r.label.toUpperCase()}
          </div>
        ))}
        <div className="absolute text-center section-label" style={{ left: colX(rounds.length), top: 0, width: m.w, borderBottom: `1px solid ${accent}`, paddingBottom: 6, color: accent }}>
          MESTER
        </div>
        <svg width={width} height={height} className="absolute left-0 top-0 pointer-events-none" aria-hidden>
          {lines}
        </svg>
        {rounds.map((r, ci) => r.matches.map((match, i) => tie(match, colX(ci), centerY(ci, i) - m.h / 2)))}
        <div
          className="absolute flex flex-col items-center justify-center gap-1 text-center"
          style={{ left: colX(rounds.length), top: finalY - m.h * 0.75, width: m.w, height: m.h * 1.5, borderRadius: 10, border: `1px ${tournament.winner ? "solid" : "dashed"} ${accent}`, color: accent, background: tournament.winner ? "color-mix(in srgb, var(--color-gold) 10%, transparent)" : "transparent", boxShadow: tournament.winner || final?.id === nextId ? "var(--glow-gold)" : undefined }}
        >
          <TrophyIcon className={large ? "w-9 h-9" : "w-6 h-6"} />
          <span className="font-display w-full px-2" style={{ lineHeight: 1.1, fontSize: large ? "var(--text-title)" : "var(--text-body)", color: tournament.winner ? "var(--color-cream)" : "var(--color-gold)" }}>
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
    </div>
    </div>
  );
}
