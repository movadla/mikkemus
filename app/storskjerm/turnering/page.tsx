"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BracketTree } from "@/components/BracketTree";
import { roundName } from "@/components/KnockoutOverview";
import { nextToThrow } from "@/lib/botSim";
import { isKnockout } from "@/lib/knockout";
import { fetchLatestTournament } from "@/lib/tournamentStorage";
import type { Tournament } from "@/lib/tournament";

const POLL_MS = 4000;

/**
 * The tournament on the big screen: the bracket filling the TV, the match to play next announced above it, and the champion when
 * the cup is over. Read-only, like the live match page next door. It shows the tournament made most recently by anyone, and looks
 * again every few seconds, so it follows the cup from one result to the next without being touched.
 */
export default function StorskjermTurneringPage() {
  const [tournament, setTournament] = useState<Tournament | null | undefined>(undefined);
  const [justDecided, setJustDecided] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let known = 0;
    const load = async () => {
      const t = await fetchLatestTournament();
      if (!live) return;
      const decided = t ? t.matches.filter((m) => m.winner && !m.isBye).length : 0;
      // A result that arrived since the last look gets its pulse and its slide into the next box.
      if (t && decided > known && known > 0) {
        const latest = [...t.matches].filter((m) => m.winner && !m.isBye && m.decidedOrder).sort((a, b) => (b.decidedOrder ?? 0) - (a.decidedOrder ?? 0))[0];
        setJustDecided(latest?.id ?? null);
      }
      known = decided;
      setTournament(t);
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  const next = tournament && isKnockout(tournament) ? nextToThrow(tournament) : null;
  return (
    <main className="min-h-screen w-full px-6 py-6" style={{ background: "var(--color-bg)", color: "var(--color-cream)" }}>
      <Link
        href="/"
        className="fixed top-2 left-2 z-40 inline-flex items-center px-4 text-xs opacity-20 hover:opacity-100 focus-visible:opacity-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)] transition-opacity"
        style={{ color: "var(--color-cream)", minHeight: "2.75rem" }}
      >
        ← Hjem
      </Link>
      {tournament === undefined && <p className="text-center pt-24" style={{ color: "var(--color-muted)", fontSize: "1.4rem" }}>Henter turneringen …</p>}
      {tournament === null && <p className="text-center pt-24" style={{ color: "var(--color-muted)", fontSize: "1.4rem" }}>Ingen turnering er i gang.</p>}
      {tournament && !isKnockout(tournament) && <p className="text-center pt-24" style={{ color: "var(--color-muted)", fontSize: "1.4rem" }}>Den siste turneringen har gruppespill og vises ikke her.</p>}
      {tournament && isKnockout(tournament) && (
        <>
          <header className="text-center mb-6">
            <p className="section-label" style={{ fontSize: "0.9rem" }}>{(tournament.cup?.name ?? "Turnering").toUpperCase()}</p>
            {tournament.status === "done" ? (
              <h1 className="font-display" style={{ color: "var(--color-gold)", fontSize: "clamp(2.5rem, 7vw, 5rem)", lineHeight: 1.05 }}>
                {tournament.winner} er mester
              </h1>
            ) : next ? (
              <h1 className="font-display" style={{ fontSize: "clamp(2rem, 5vw, 3.6rem)", lineHeight: 1.1 }}>
                <span style={{ color: "var(--color-teal)" }}>{roundName(next)}</span>: {next.participantA} mot {next.participantB}
              </h1>
            ) : (
              <h1 className="font-display" style={{ fontSize: "2rem" }}>Venter på neste kamp</h1>
            )}
            {tournament.cup && tournament.status !== "done" && <p style={{ color: "var(--color-muted)", fontSize: "1.1rem" }}>Spiller om {tournament.cup.trophy}</p>}
          </header>
          <div className="rounded-2xl p-4 mx-auto" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", maxWidth: "100rem" }}>
            <BracketTree tournament={tournament} nextId={next?.id ?? null} justDecidedId={justDecided} large />
          </div>
        </>
      )}
    </main>
  );
}
