"use client";

import { useEffect, useState } from "react";
import {
  createTournament,
  matchParticipants,
  recordMatchResult,
  suggestGroups,
  MAX_WITHOUT_GROUP_SCREEN,
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
import { botSetupForMatch, type CupConfig } from "@/lib/botCup";
import type { GameVariant } from "@/lib/rules";
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
  const [pendingVariant, setPendingVariant] = useState<GameVariant>("standard");
  const [pendingCup, setPendingCup] = useState<CupConfig | null>(null);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  // The match that just ended, so the overview can show what it did to the table. Kept only until
  // the next match starts — it is about the moment after a result, not a permanent setting. A
  // reload starts without it, which is right: the table is then simply the table.
  const [justPlayedId, setJustPlayedId] = useState<string | null>(null);
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

  /** Makes the tournament and opens it. Everything it needs is passed in, because the small-
   *  tournament shortcut below calls it in the same breath as the setup screen's own submit,
   *  before any `pending…` state has been applied. */
  async function createAndOpen(mode: TournamentMode, participants: Participant[], variant: GameVariant, groups: string[][], matchSize: number, cup?: CupConfig) {
    if (submitting) return;
    setSubmitting(true);
    const id = newTournamentId();
    // Playing several at once is an individual-mode-only setting — a team match is always 1 team
    // vs 1 team, regardless of whatever the (hidden, for team mode) matchSize toggle last held.
    const created = createTournament(mode, participants, groups, id, new Date().toISOString(), mode === "team" ? 2 : matchSize, variant, cup);
    setTournament(created);
    setJustPlayedId(null);
    saveActiveTournamentId(id);
    setScreen("overview");
    await upsertTournament(created);
    setSubmitting(false);
  }

  function handleSetupNext(mode: TournamentMode, participants: Participant[], variant: GameVariant, adjustGroups: boolean, cup?: CupConfig) {
    setPendingMode(mode);
    setPendingParticipants(participants);
    setPendingVariant(variant);
    setPendingCup(cup ?? null);
    // Up to four play in a single group, so there is nothing for the group screen to decide: the
    // tournament is made straight away unless the user asked to adjust the groups.
    if (!adjustGroups && participants.length <= MAX_WITHOUT_GROUP_SCREEN) {
      void createAndOpen(mode, participants, variant, suggestGroups(participants.map((p) => p.name)), 2, cup);
      return;
    }
    setScreen("group-setup");
  }

  async function handleGenerate(groups: string[][], matchSize: number) {
    if (!pendingMode || !pendingParticipants) return;
    await createAndOpen(pendingMode, pendingParticipants, pendingVariant, groups, matchSize, pendingCup ?? undefined);
  }

  /** A finished tournament, played again by the same people: back to the setup screen with
   *  everyone already in, to change what they want and start. */
  function handleNewWithSame() {
    if (!tournament) return;
    // A cup against bots is made anew, with other bots: only the house's own entrants carry over.
    setPendingMode(tournament.mode);
    setPendingParticipants(tournament.cup ? tournament.participants.filter((p) => (p.members ? p.members.some((m) => !m.isBot) : !p.isBot)) : tournament.participants);
    setPendingCup(tournament.cup ?? null);
    setPendingVariant(tournament.variant ?? "standard");
    setTournament(null);
    setJustPlayedId(null);
    setScreen("setup");
  }

  function handlePlayNext(match: TournamentMatch) {
    setJustPlayedId(null);
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
    setJustPlayedId(currentMatch.id);
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
        initialVariant={pendingVariant}
        initialCup={pendingCup}
      />
    );
  }

  if (screen === "group-setup" && pendingMode && pendingParticipants) {
    return (
      <TournamentGroupSetupScreen
        participantNames={pendingParticipants.map((p) => p.name)}
        onBack={() => setScreen("setup")}
        onGenerate={handleGenerate}
        submitting={submitting}
      />
    );
  }

  if (screen === "match" && tournament && currentMatch && matchParticipants(currentMatch).length >= 2) {
    // For a cup against bots the levels are those of this very match: how far into the cup it is, and the bots' form.
    const { botLevels, teamRosters } = botSetupForMatch(tournament, currentMatch);
    return (
      <MikkeMusApp
        initialPlayers={matchParticipants(currentMatch)}
        initialBotLevels={botLevels}
        initialTeamRosters={teamRosters}
        initialVariant={tournament.variant ?? "standard"}
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
        justPlayedId={justPlayedId}
        onNewWithSame={handleNewWithSame}
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
