"use client";

import { useEffect, useState } from "react";
import {
  createTournament,
  matchParticipants,
  recordMatchResult,
  type Participant,
  type Tournament,
  type TournamentMatch,
  type TournamentMode,
} from "@/lib/tournament";
import {
  clearActiveTournamentId,
  deleteTournament,
  fetchTournament,
  loadActiveTournamentId,
  newTournamentId,
  saveActiveTournamentId,
  upsertTournament,
} from "@/lib/tournamentStorage";
import { loadActiveMatch } from "@/lib/activeMatch";
import type { BotLevel, TeamMember } from "@/lib/botLevels";
import { DartboardGlyph } from "./DartboardGlyph";
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
    tournament.matches.find((m) => {
      if (m.winner) return false;
      const participants = matchParticipants(m);
      return participants.length >= 2 && participants.every((p) => active.players.includes(p));
    }) ?? null
  );
}

export function TournamentApp({ onExitToHome }: { onExitToHome: () => void }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [pendingMode, setPendingMode] = useState<TournamentMode | null>(null);
  const [pendingParticipants, setPendingParticipants] = useState<Participant[] | null>(null);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  // Guards "Generer turnering" and the cancel-tournament confirm button against a double-tap
  // firing a second Supabase write while the first is still in flight.
  const [submitting, setSubmitting] = useState(false);

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
    fetchTournament(id).then((result) => {
      if (result.status === "not-found") {
        clearActiveTournamentId();
        setScreen("setup");
        return;
      }
      if (result.status === "error") {
        // Do NOT clear the resume pointer here — a transient network failure shouldn't
        // permanently lose the ability to resume once the connection is back.
        setScreen("setup");
        return;
      }
      const t = result.tournament;
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

  async function handleGenerate(groups: string[][], matchSize: number) {
    if (!pendingMode || !pendingParticipants || submitting) return;
    setSubmitting(true);
    const id = newTournamentId();
    // Playing several at once is an individual-mode-only setting — a team match is always 1 team
    // vs 1 team, regardless of whatever the (hidden, for team mode) matchSize toggle last held.
    const created = createTournament(pendingMode, pendingParticipants, groups, id, new Date().toISOString(), pendingMode === "team" ? 2 : matchSize);
    setTournament(created);
    saveActiveTournamentId(id);
    setScreen("overview");
    await upsertTournament(created);
    setSubmitting(false);
  }

  function handlePlayNext(match: TournamentMatch) {
    setCurrentMatch(match);
    setScreen("match");
  }

  /** A match paused/aborted mid-play (not finished — see handleMatchComplete for that) has
   *  nowhere better to land than the tournament it's still part of. Passed as MikkeMusApp's
   *  onExitToHome specifically for the "match" screen below — that prop is otherwise only reached
   *  by its tournament-only abort branch in this context, so redirecting it here doesn't affect
   *  anything else. The match itself stays unplayed in `tournament.matches` and can be replayed
   *  from the overview. */
  function handleMatchAbort() {
    setCurrentMatch(null);
    setScreen("overview");
  }

  async function handleMatchComplete(result: { winner: string; placements: string[]; stats: Record<string, import("@/lib/game").TurnAggregate> }) {
    if (!tournament || !currentMatch) return;
    const updated = recordMatchResult(tournament, currentMatch.id, result.placements, result.stats);
    setTournament(updated);
    setCurrentMatch(null);
    setScreen("overview");
    await upsertTournament(updated);
    if (updated.status === "done") clearActiveTournamentId();
  }

  /** Permanently abandons the tournament (confirmed on TournamentOverviewScreen first) — unlike a
   *  completed tournament, an aborted one has no value to keep around, so it's deleted outright
   *  rather than just cleared locally. */
  async function handleCancelTournament() {
    if (!tournament || submitting) return;
    setSubmitting(true);
    clearActiveTournamentId();
    await deleteTournament(tournament.id);
    onExitToHome();
  }

  if (screen === "loading") {
    return (
      <div
        className="animate-screen-enter min-h-screen w-full flex items-center justify-center"
        style={{ background: "var(--color-bg)" }}
      >
        <DartboardGlyph className="w-14 h-14" />
      </div>
    );
  }

  if (screen === "setup") {
    return (
      <TournamentSetupScreen
        onBack={onExitToHome}
        onNext={handleSetupNext}
        initialMode={pendingMode}
        initialParticipants={pendingParticipants}
      />
    );
  }

  if (screen === "group-setup" && pendingMode && pendingParticipants) {
    return (
      <TournamentGroupSetupScreen
        participantNames={pendingParticipants.map((p) => p.name)}
        mode={pendingMode}
        onBack={() => setScreen("setup")}
        onGenerate={handleGenerate}
        submitting={submitting}
      />
    );
  }

  if (screen === "match" && tournament && currentMatch && matchParticipants(currentMatch).length >= 2) {
    const botLevels: Record<string, BotLevel> = {};
    const teamRosters: Record<string, TeamMember[]> = {};
    tournament.participants.forEach((p) => {
      if (p.isBot && p.botLevel) botLevels[p.name] = p.botLevel;
      if (p.members && p.members.length > 0) teamRosters[p.name] = p.members;
    });
    return (
      <MikkeMusApp
        initialPlayers={matchParticipants(currentMatch)}
        initialBotLevels={botLevels}
        initialTeamRosters={teamRosters}
        onMatchComplete={handleMatchComplete}
        onExitToHome={handleMatchAbort}
      />
    );
  }

  if (tournament) {
    return (
      <TournamentOverviewScreen
        tournament={tournament}
        onPlayNext={handlePlayNext}
        onExitToHome={onExitToHome}
        onCancelTournament={handleCancelTournament}
        cancelingTournament={submitting}
      />
    );
  }

  return (
    <TournamentSetupScreen
      onBack={onExitToHome}
      onNext={handleSetupNext}
      initialMode={pendingMode}
      initialParticipants={pendingParticipants}
    />
  );
}
