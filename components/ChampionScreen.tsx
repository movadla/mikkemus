"use client";

import { useState } from "react";
import { awards, isHouseName, outIn, roadOf, undoableMatch } from "@/lib/knockout";
import { fxFlags, useFxLevel } from "@/lib/fxLevel";
import { firstKit } from "@/lib/teamKit";
import { podium, tournamentTitle, type Tournament } from "@/lib/tournament";
import { BracketTree } from "./BracketTree";
import { ShirtRain } from "./ShirtRain";
import { Trophy } from "./Trophy";
import { roundName } from "./KnockoutOverview";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const card = { background: "var(--color-panel)", border: "1px solid var(--color-border)" } as const;

/**
 * The end of a cup: the trophy over the winner (with the winning team's own shirts raining, for a team), the road to the title
 * round by round, the small prizes, the podium and the final bracket. The same screen opens an old cup from the trophy cabinet
 * (`onClose`), without the buttons that start a new one.
 */
export function ChampionScreen({
  tournament,
  onNewWithSame,
  onHome,
  onClose,
  onUndo,
}: {
  tournament: Tournament;
  onNewWithSame?: () => void;
  onHome?: () => void;
  onClose?: () => void;
  /** Takes the final back, when the wrong winner was recorded. */
  onUndo?: () => void;
}) {
  const level = useFxLevel();
  const fx = fxFlags(level);
  const [showBracket, setShowBracket] = useState(false);
  const winner = tournament.winner ?? "";
  const winnerSide = tournament.participants.find((p) => p.name === winner);
  const road = roadOf(tournament, winner).filter((r) => !r.match.isBye);
  const prizes = awards(tournament);
  const places = podium(tournament);
  const trophy = tournament.cup?.trophy;
  const houseOut = tournament.participants.filter((p) => isHouseName(tournament, p.name) && p.name !== winner && outIn(tournament, p.name));
  const shirts = !!winnerSide?.members && fx.shirtRain ? firstKit(winnerSide.members.map((m) => m.name)) : null;
  return (
    <div className="animate-winner-slam relative min-h-screen w-full overflow-x-hidden" style={{ background: "var(--color-bg)" }}>
      <div className="animate-winner-flash absolute inset-0 pointer-events-none z-50" style={{ background: "var(--color-gold)" }} aria-hidden />
      {shirts && <ShirtRain kit={shirts} heavy={fx.bigConfetti} />}
      <div className="relative z-10 mx-auto w-full px-4 pt-6 pb-10" style={{ maxWidth: "36rem" }}>
        {onClose && (
          <button type="button" onClick={onClose} className={`tactile rounded-lg text-sm mb-4 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", padding: "0 1rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
            ← Tilbake
          </button>
        )}
        <p className="section-label text-center" style={{ color: "var(--color-gold)" }}>
          {tournamentTitle(tournament).toUpperCase()} · MESTER
        </p>
        <Trophy cannons={fx.confetti && !shirts} />
        <h1 className="font-display text-center" style={{ color: "var(--color-gold)", fontSize: "clamp(2.2rem, 11vw, 3.4rem)", lineHeight: 1.05 }}>
          {winner}
        </h1>
        {trophy && (
          <p className="text-center mt-1" style={{ color: "var(--color-cream)" }}>
            vinner {trophy}
          </p>
        )}
        {winnerSide?.members && (
          <p className="text-center" style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>
            {winnerSide.members.map((m) => m.name).join(" og ")}
          </p>
        )}
        {houseOut.length > 0 && !isHouseName(tournament, winner) && (
          <p className="text-center mt-2" style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>
            {houseOut.map((p) => `${p.name} ute i ${roundName(outIn(tournament, p.name)!).toLowerCase()}`).join(" · ")}
          </p>
        )}

        {road.length > 0 && (
          <section className="shadow-panel rounded-xl p-4 mt-6" style={card} aria-label="Veien til pokalen">
            <p className="section-label mb-3">VEIEN TIL POKALEN</p>
            <ol className="space-y-2">
              {road.map((r) => {
                const mine = r.match.stats?.[winner];
                const theirs = r.opponent ? r.match.stats?.[r.opponent] : undefined;
                return (
                  <li key={r.match.id} className="flex items-baseline justify-between gap-3">
                    <span style={{ color: "var(--color-muted)", fontSize: "0.8rem", minWidth: "6.5rem" }}>{r.label}</span>
                    <span className="flex-1 truncate" style={{ color: "var(--color-cream)" }}>
                      {r.won ? "slo " : "tapte for "}
                      <span style={{ fontWeight: 600 }}>{r.opponent ?? "walkover"}</span>
                    </span>
                    {mine && theirs && (
                      <span className="tabular shrink-0" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
                        {mine.darts}–{theirs.darts} piler
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {prizes.length > 0 && (
          <section className="shadow-panel rounded-xl p-4 mt-4" style={card} aria-label="Utmerkelser">
            <p className="section-label mb-3">UTMERKELSER</p>
            <div className="space-y-2">
              {prizes.map((a) => (
                <div key={a.title} className="flex items-baseline justify-between gap-3">
                  <span style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>{a.title}</span>
                  <span className="text-right" style={{ color: "var(--color-cream)" }}>
                    <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>{a.name}</span>
                    <span className="block" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                      {a.detail}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {places && (
          <section className="shadow-panel rounded-xl p-4 mt-4" style={card} aria-label="Pallen">
            <p className="section-label mb-3">PALLEN</p>
            <ol className="space-y-1" style={{ color: "var(--color-cream)" }}>
              <li>1. {places.first}</li>
              {places.second && <li>2. {places.second}</li>}
              {places.third && <li>3. {places.third}</li>}
            </ol>
          </section>
        )}

        <button type="button" onClick={() => setShowBracket((v) => !v)} className={`tactile w-full rounded-lg mt-4 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
          {showBracket ? "Skjul brakett" : "Se hele braketten"}
        </button>
        {showBracket && (
          <div className="shadow-panel rounded-xl p-3 mt-3" style={card}>
            <BracketTree tournament={tournament} />
          </div>
        )}

        <div className="space-y-2 mt-6">
          {onNewWithSame && (
            <button type="button" onClick={onNewWithSame} className={`glossy w-full rounded-xl font-semibold text-lg ${FOCUS_RING}`} style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "3.25rem" } as React.CSSProperties}>
              {tournament.cup ? "Ny pokalturnering med de samme" : "Ny turnering med samme deltakere"}
            </button>
          )}
          {onUndo && undoableMatch(tournament) && (
            <button type="button" onClick={onUndo} className={`tactile w-full rounded-lg text-sm ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "transparent", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}>
              Feil vinner? Angre finalen
            </button>
          )}
          {onHome && (
            <button type="button" onClick={onHome} className={`tactile w-full rounded-lg ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
              Til forsiden
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
