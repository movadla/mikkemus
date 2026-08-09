"use client";

import { useEffect, useState } from "react";
import {
  createTournament,
  recordMatchResult,
  type Participant,
  type Tournament,
  type TournamentMatch,
  type TournamentMode,
} from "@/lib/tournament";
import {
  clearActiveTournamentId,
  fetchTournament,
  loadActiveTournamentId,
  newTournamentId,
  saveActiveTournamentId,
  upsertTournament,
} from "@/lib/tournamentStorage";
import { loadActiveMatch } from "@/lib/activeMatch";
import type { BotLevel } from "@/lib/botLevels";
import { MikkeMusApp } from "./MikkeMusApp";
import { TournamentSetupScreen } from "./TournamentSetupScreen";
import { TournamentGroupSetupScreen } from "./TournamentGroupSetupScreen";
import { TournamentOverviewScreen } from "./TournamentOverviewScreen";

type Screen = "loading" | "setup" | "group-setup" | "overview" | "match";

/** Finds the tournament match a resumed single-match session belongs to, by matching its two
 *  player names — lets a mid-match refresh resume correctly without needing separate persisted
 *  "which match slot" bookkeeping (see lib/tournamentStorage.ts's doc comment). */
function findResumableMatch(tournament: Tournament): TournamentMatch | null {
  const active = loadActiveMatch();
  if (!active) return null;
  return (
    tournament.matches.find(
      (m) => !m.winner && m.participantA && m.participantB && active.players.includes(m.participantA) && active.players.includes(m.participantB)
    ) ?? null
  );
}

export function TournamentApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [pendingMode, setPendingMode] = useState<TournamentMode | null>(null);
  const [pendingParticipants, setPendingParticipants] = useState<Participant[] | null>(null);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);

  // One-time resolution of which screen to start on, from external state (localStorage's active-
  // tournament pointer + a Supabase fetch) — same "you might not need an effect" exception
  // already used for MikkeMusApp's own activeMatch restore, not a render-loop.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const id = loadActiveTournamentId();
    if (!id) {
      setScreen("setup");
      return;
    }
    fetchTournament(id).then((t) => {
      if (!t) {
        clearActiveTournamentId();
        setScreen("setup");
        return;
      }
      setTournament(t);
      const resumable = findResumableMatch(t);
      if (resumable) {
        setCurrentMatch(resumable);
        setScreen("match");
      } else {
        setScreen("overview");
      }
    });
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleSetupNext(mode: TournamentMode, participants: Participant[]) {
    setPendingMode(mode);
    setPendingParticipants(participants);
    setScreen("group-setup");
  }

  async function handleGenerate(groups: string[][]) {
    if (!pendingMode || !pendingParticipants) return;
    const id = newTournamentId();
    const created = createTournament(pendingMode, pendingParticipants, groups, id, new Date().toISOString());
    setTournament(created);
    saveActiveTournamentId(id);
    setScreen("overview");
    await upsertTournament(created);
  }

  function handlePlayNext(match: TournamentMatch) {
    setCurrentMatch(match);
    setScreen("match");
  }

  async function handleMatchComplete(result: { winner: string; stats: Record<string, import("@/lib/game").TurnAggregate> }) {
    if (!tournament || !currentMatch) return;
    const updated = recordMatchResult(tournament, currentMatch.id, result.winner, result.stats);
    setTournament(updated);
    setCurrentMatch(null);
    setScreen("overview");
    await upsertTournament(updated);
    if (updated.status === "done") clearActiveTournamentId();
  }

  if (screen === "loading") {
    return <div className="min-h-screen w-full" style={{ background: "var(--color-bg)" }} />;
  }

  if (screen === "setup") {
    return <TournamentSetupScreen onBack={onExitToHome} onNext={handleSetupNext} />;
  }

  if (screen === "group-setup" && pendingParticipants) {
    return (
      <TournamentGroupSetupScreen
        participantNames={pendingParticipants.map((p) => p.name)}
        onBack={() => setScreen("setup")}
        onGenerate={handleGenerate}
      />
    );
  }

  if (screen === "match" && tournament && currentMatch && currentMatch.participantA && currentMatch.participantB) {
    const botLevels: Record<string, BotLevel> = {};
    tournament.participants.forEach((p) => {
      if (p.isBot && p.botLevel) botLevels[p.name] = p.botLevel;
    });
    return (
      <MikkeMusApp
        initialPlayers={[currentMatch.participantA, currentMatch.participantB]}
        initialBotLevels={botLevels}
        onMatchComplete={handleMatchComplete}
      />
    );
  }

  if (tournament) {
    return <TournamentOverviewScreen tournament={tournament} onPlayNext={handlePlayNext} onExitToHome={onExitToHome} />;
  }

  return <TournamentSetupScreen onBack={onExitToHome} onNext={handleSetupNext} />;
}
