"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadActiveTournamentId } from "@/lib/tournamentStorage";
import { useScolia } from "@/lib/useScolia";
import { DartboardGlyph } from "./DartboardGlyph";
import { DartIcon, TrophyIcon } from "./icons";
import { MikkeMusApp } from "./MikkeMusApp";
import { ScoliaStatusBadge } from "./ScoliaStatusBadge";
import { TournamentApp } from "./TournamentApp";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type Mode = "home" | "single" | "tournament";

/** The very first thing rendered — chooses between a one-off "Singel game" (today's app,
 *  unchanged) and "Tournament" mode. Replaces the old direct `<MikkeMusApp />` in app/page.tsx. */
export function AppRoot() {
  const [mode, setMode] = useState<Mode>("home");
  const [hasActiveTournament, setHasActiveTournament] = useState(false);
  // Only connected while the home screen itself is showing — MikkeMusApp/TournamentApp own their
  // own connection once a mode is picked, so this never runs two connections at once.
  const scolia = useScolia(mode === "home", {});

  // Re-read external state (localStorage) every time the home screen itself comes back into
  // view, not just on first mount — otherwise cancelling or finishing a tournament wouldn't
  // update this button until a hard refresh, since returning here is just a mode change, not a
  // remount. Same "you might not need an effect" exception already used by MikkeMusApp's/
  // TournamentApp's own resume-on-load effects, not a render-loop.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode === "home") setHasActiveTournament(!!loadActiveTournamentId());
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (mode === "single") return <MikkeMusApp onExitToHome={() => setMode("home")} />;
  if (mode === "tournament") return <TournamentApp onExitToHome={() => setMode("home")} />;

  return (
    <div className="animate-screen-enter min-h-screen w-full flex items-center justify-center p-6" style={{ background: "var(--color-bg)" }}>
      <ScoliaStatusBadge state={scolia.state} />
      <div className="w-full max-w-md">
        <DartboardGlyph className="w-14 h-14 mx-auto mb-2 block" />
        <h1 className="text-center mb-10 font-display" style={{ color: "var(--color-cream)", fontSize: "2.5rem", letterSpacing: "0.02em" }}>
          Mikke Mus <span aria-hidden>🐭</span>
        </h1>
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`tactile w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2.5 ${FOCUS_RING}`}
            style={{ background: "var(--color-green)", color: "var(--color-cream)" }}
          >
            <DartIcon className="w-5 h-5" />
            Singelspill
          </button>
          <button
            type="button"
            onClick={() => setMode("tournament")}
            className={`tactile w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2.5 ${FOCUS_RING}`}
            style={{ background: "var(--color-teal)", color: "var(--color-bg)" }}
          >
            <TrophyIcon className="w-5 h-5" />
            {hasActiveTournament ? "Fortsett turnering" : "Turnering"}
          </button>
        </div>
        <p className="text-center mt-8">
          <Link
            href="/storskjerm"
            className={`font-display text-sm underline ${FOCUS_RING}`}
            style={{ color: "var(--color-muted)", fontStyle: "italic" }}
          >
            📺 Åpne storskjerm-visning
          </Link>
        </p>
      </div>
    </div>
  );
}
