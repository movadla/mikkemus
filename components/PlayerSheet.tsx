"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { averagePct, useRoster, type PlayerRecord } from "@/lib/storage";
import { shownHitPct } from "@/lib/playerRows";
import { avatarAccent } from "@/lib/avatarAccent";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function Form({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const lo = Math.min(...points), hi = Math.max(...points), span = Math.max(1, hi - lo);
  const line = points.map((p, i) => `${(i / (points.length - 1)) * 200 + 4},${34 - ((p - lo) / span) * 28}`).join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg viewBox="0 0 208 40" className="w-full" height={40} role="img" aria-label="Treffprosent de siste kampene">
      <polyline points={line} fill="none" stroke={up ? "#58b072" : "#e25a45"} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Numbers({ rec }: { rec: PlayerRecord }) {
  const form = rec.matchHistory.slice(-10).map((h) => shownHitPct(h));
  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: rec.matchesPlayed === 0 ? "–" : `${averagePct(rec.overall)} %`, l: "TREFF" },
          { v: rec.bestRun ? `${rec.bestRun}` : "–", l: "BESTE SERIE" },
          { v: `${rec.matchesWon}–${Math.max(0, rec.matchesPlayed - rec.matchesWon)}`, l: "SEIRER" },
        ].map((n) => (
          <div key={n.l}>
            <p className="font-display tabular" style={{ fontSize: "1.6rem" }}>
              {n.v}
            </p>
            <p style={{ color: "var(--color-muted)", fontSize: "0.72rem", letterSpacing: "0.1em" }}>{n.l}</p>
          </div>
        ))}
      </div>
      <Form points={form} />
    </>
  );
}

/**
 * The thrower's numbers, from the bottom of the screen, without leaving the board: hit percentage,
 * longest run, wins and the form over the last ten matches — their own, and their team's. Drag it
 * down, tap outside it or press Lukk to close.
 */
export function PlayerSheet({ name, team, onClose }: { name: string; team: string | null; onClose: () => void }) {
  const roster = useRoster();
  const rec = roster.find((r) => r.kind !== "team" && same(r.name, name));
  const teamRec = team ? roster.find((r) => r.kind === "team" && same(r.name, team)) : undefined;
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);

  return (
    <div className="fixed inset-0 z-[57]" role="dialog" aria-modal="true" aria-label={`Statistikk for ${name}`}>
      <button type="button" aria-label="Lukk" onClick={onClose} className="absolute inset-0 w-full h-full" style={{ background: "rgba(0,0,0,0.55)" }} />
      <div
        className="absolute left-0 right-0 bottom-0 rounded-t-2xl px-4 pb-6 pt-2 max-w-3xl mx-auto"
        style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", transform: `translateY(${dy}px)`, transition: dragging ? "none" : "transform 250ms ease", touchAction: "none" }}
        onPointerDown={(e) => {
          start.current = e.clientY;
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current !== null) setDy(Math.max(0, e.clientY - start.current));
        }}
        onPointerUp={() => {
          const moved = dy;
          start.current = null;
          setDragging(false);
          if (moved > 70) onClose();
          else setDy(0);
        }}
      >
        <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 5, background: "var(--color-border)" }} aria-hidden />
        <div className="flex items-center gap-3 mb-4">
          <span className="rounded-full flex items-center justify-center font-display shrink-0 overflow-hidden" style={{ width: 48, height: 48, border: `3px solid ${avatarAccent(name)}`, background: "var(--color-cell)", color: avatarAccent(name), fontSize: "1.2rem" }} aria-hidden>
            {rec?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rec.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </span>
          <p className="font-display flex-1 truncate" style={{ fontSize: "1.5rem" }}>
            {name}
          </p>
          <button type="button" onClick={onClose} className="tactile px-4 rounded-lg text-sm" style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
            Lukk
          </button>
        </div>
        {rec ? (
          <Numbers rec={rec} />
        ) : (
          <p style={{ color: "var(--color-muted)" }}>Ingen statistikk for {name} (gjest eller bot).</p>
        )}
        {teamRec && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
            <p className="section-label mb-2">LAGET · {teamRec.name}</p>
            <Numbers rec={teamRec} />
          </div>
        )}
        {rec && (
          <Link href={`/spillere/${encodeURIComponent(rec.name)}`} className="block mt-4 text-center rounded-lg" style={{ lineHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
            Hele statistikken
          </Link>
        )}
      </div>
    </div>
  );
}
