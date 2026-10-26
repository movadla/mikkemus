"use client";

import { useEffect, useState } from "react";
import { matchParticipants, recordMatchResult, type Participant, type Tournament, type TournamentMatch, type TournamentMode } from "@/lib/tournament";
import { createKnockout, houseAlive, isKnockout, seedByStrength, undoLastResult } from "@/lib/knockout";
import { tieGroups, withGroupOrder } from "@/lib/bullOff";
import { createPilot, isPilot, pilotPlayers, playPilotBots, undoPilotResult } from "@/lib/pilot";
import { sigmaForLevel } from "@/lib/botStrategy";
import { clearPendingTies, loadPendingTies, savePendingTies } from "@/lib/pilotTies";
import { playElsewhere } from "@/lib/botSim";
import { strengthMap } from "@/lib/knockoutSeeding";
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
import { championShowOf } from "@/lib/championShow";
import { publishShow } from "@/lib/liveMatch";
import { botSetupForMatch, type CupConfig } from "@/lib/botCup";
import { RULES, baseOf, type GameVariant } from "@/lib/rules";
import { announce } from "@/lib/announcer";
import { getFxLevel } from "@/lib/fxLevel";
import { playFanfare, playWinBoom, primeAudio } from "@/lib/fanfare";
import { useRoster } from "@/lib/storage";
import { DartboardGlyph } from "./DartboardGlyph";
import { ChampionScreen } from "./ChampionScreen";
import { BullOffScreen } from "./BullOffScreen";
import { DrawScreen } from "./DrawScreen";
import { PilotOverview } from "./PilotOverview";
import { EliminatedScreen } from "./EliminatedScreen";
import { KnockoutOverview, roundName } from "./KnockoutOverview";
import { MikkeMusApp } from "./MikkeMusApp";
import { TournamentHistoryScreen } from "./TournamentHistoryScreen";
import { TournamentSetupScreen } from "./TournamentSetupScreen";
import { TournamentOverviewScreen } from "./TournamentOverviewScreen";

type Screen = "loading" | "setup" | "draw" | "overview" | "match" | "bulloff" | "eliminated" | "champion" | "history";

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
  const roster = useRoster();
  const [screen, setScreen] = useState<Screen>("loading");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [pendingMode, setPendingMode] = useState<TournamentMode | null>(null);
  const [pendingParticipants, setPendingParticipants] = useState<Participant[] | null>(null);
  const [pendingVariant, setPendingVariant] = useState<GameVariant>("standard");
  const [pendingCup, setPendingCup] = useState<CupConfig | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  // The match that just ended, so the overview can show what it did to the bracket. Kept only until
  // the next match starts — it is about the moment after a result, not a permanent setting. A
  // reload starts without it, which is right: the bracket is then simply the bracket.
  const [justPlayedId, setJustPlayedId] = useState<string | null>(null);
  // The matches the model decided around that one, for the list of results from elsewhere.
  const [elsewhereIds, setElsewhereIds] = useState<string[]>([]);
  // Where the trophy cabinet was opened from, so Tilbake goes back there.
  const [historyFrom, setHistoryFrom] = useState<"setup" | "overview">("setup");
  // Guards "Generer turnering" and the cancel-tournament confirm button against a double-tap
  // firing a second Supabase write while the first is still in flight.
  const [submitting, setSubmitting] = useState(false);
  // A match of four that ended level for a place: the result waits here while the bull-offs are thrown (lib/bullOff.ts).
  const [ties, setTies] = useState<{ placements: string[]; stats: Record<string, import("@/lib/game").TurnAggregate>; groups: string[][] } | null>(null);

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
      // A match of the pilot that ended level and whose bull-offs were not all thrown: pick up at the bull-off.
      const saved = loadPendingTies();
      const waiting = saved && saved.tournamentId === t.id ? t.matches.find((m) => m.id === saved.matchId && !m.winner) : undefined;
      if (saved && waiting) {
        setCurrentMatch(waiting);
        setTies({ placements: saved.placements, stats: saved.stats, groups: saved.groups });
        setScreen("bulloff");
      } else if (resumable) {
        setCurrentMatch(resumable);
        setScreen("match");
      } else if (isKnockout(t) && t.cup && t.status !== "done" && !houseAlive(t)) {
        // The house went out and the cup was left unfinished: pick up at the question of watching the rest.
        setScreen("eliminated");
      } else {
        setScreen("overview");
      }
    });
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** The draw's order is the seeding: strongest first, by what the matches say about each. */
  function seededOrder(): Participant[] {
    const list = pendingParticipants ?? [];
    const rules = RULES[baseOf(pendingVariant)];
    const strength = strengthMap(roster, list, { target: rules.target, ringChoice: rules.ringOnOwnNumberIsChoice });
    return seedByStrength(list, (name) => strength.get(name) ?? 0.5);
  }

  /** Makes the tournament from the draw's order and opens it. */
  async function createAndOpen(order: Participant[]) {
    if (submitting || !pendingMode) return;
    setSubmitting(true);
    const id = newTournamentId();
    const made = createKnockout(pendingMode, order, id, new Date().toISOString(), pendingVariant, pendingCup ?? undefined);
    const created = pendingName ? { ...made, name: pendingName } : made;
    setTournament(created);
    setJustPlayedId(null);
    setElsewhereIds([]);
    saveActiveTournamentId(id);
    setScreen("overview");
    await upsertTournament(created);
    setSubmitting(false);
  }

  /** Ly Pilotturnering (lib/pilot.ts): seeded by strength and started at once, there is no draw to make. The heats of bots only are decided. */
  async function startPilot(participants: Participant[], variant: GameVariant, cup: CupConfig, name?: string) {
    if (submitting) return;
    setSubmitting(true);
    const rules = RULES[baseOf(variant)];
    const strength = strengthMap(roster, participants, { target: rules.target, ringChoice: rules.ringOnOwnNumberIsChoice });
    const order = seedByStrength(participants, (n) => strength.get(n) ?? 0.5);
    const id = newTournamentId();
    const made = createPilot("individual", order, id, new Date().toISOString(), variant, cup);
    const { tournament: started, decided } = playPilotBots(name ? { ...made, name } : made);
    setPendingMode("individual");
    setPendingParticipants(participants);
    setPendingVariant(variant);
    setPendingCup(cup);
    setPendingName(name ?? "");
    setTournament(started);
    setJustPlayedId(null);
    setElsewhereIds(decided);
    saveActiveTournamentId(id);
    setScreen("overview");
    await upsertTournament(started);
    setSubmitting(false);
  }

  function handleSetupNext(mode: TournamentMode, participants: Participant[], variant: GameVariant, cup?: CupConfig, name?: string) {
    if (cup?.kind === "open" && mode === "individual") {
      void startPilot(participants, variant, cup, name);
      return;
    }
    setPendingName(name ?? "");
    setPendingMode(mode);
    setPendingParticipants(participants);
    setPendingVariant(variant);
    setPendingCup(cup ?? null);
    setScreen("draw");
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
    setElsewhereIds([]);
    setScreen("setup");
  }

  function handlePlayNext(match: TournamentMatch) {
    setJustPlayedId(null);
    setElsewhereIds([]);
    setCurrentMatch(match);
    setScreen("match");
    // The round is named when the match starts: a quarter-final should sound like one. Enkel is silent, Vanlig only speaks.
    const level = getFxLevel();
    if (level !== "simple" && tournament && isPilot(tournament)) {
      announce(`${match.pilot?.label}. ${pilotPlayers(match).join(", ")}.`);
      if (level !== "normal" && match.pilot?.stage === "final") {
        primeAudio();
        playFanfare();
      }
    }
    if (level !== "simple" && tournament && isKnockout(tournament)) {
      const [a, b] = matchParticipants(match);
      announce(`${roundName(match)}. ${a} mot ${b}.`);
      if (level !== "normal") {
        primeAudio();
        if (match.bracketRoundSize === 1 && !match.isBronzeMatch) playFanfare();
        else if (match.bracketRoundSize === 2 && !match.isBronzeMatch) playWinBoom();
      }
    }
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

  /** A match of the pilot is over with its places settled: record it, let the bots' matches that it opened be played, and go on. */
  async function finishPilotMatch(placements: string[], stats: Record<string, import("@/lib/game").TurnAggregate>) {
    if (!tournament || !currentMatch) return;
    const recorded = recordMatchResult(tournament, currentMatch.id, placements, stats);
    const { tournament: updated, decided } = playPilotBots(recorded);
    setTournament(updated);
    setJustPlayedId(currentMatch.id);
    setElsewhereIds(decided);
    setCurrentMatch(null);
    setTies(null);
    clearPendingTies();
    setScreen(updated.status === "done" ? "champion" : "overview");
    await upsertTournament(updated);
    if (updated.status === "done") clearActiveTournamentId();
  }

  async function handleMatchComplete(result: { winner: string; placements: string[]; stats: Record<string, import("@/lib/game").TurnAggregate>; remaining?: Record<string, number> }) {
    if (!tournament || !currentMatch) return;
    if (isPilot(tournament)) {
      // Level on crosses missing is a tie for a place: a bull-off, for each group that is level.
      const groups = result.remaining ? tieGroups(result.placements, result.remaining) : [];
      if (groups.length > 0) {
        setTies({ placements: result.placements, stats: result.stats, groups });
        savePendingTies({ tournamentId: tournament.id, matchId: currentMatch.id, placements: result.placements, stats: result.stats, groups });
        setScreen("bulloff");
        return;
      }
      await finishPilotMatch(result.placements, result.stats);
      return;
    }
    let updated = recordMatchResult(tournament, currentMatch.id, result.placements, result.stats);
    let decided: string[] = [];
    const wasAlive = houseAlive(tournament);
    // In a cup the matches nobody of the house plays in are settled now — unless the house is out, which has its own question first.
    if (isKnockout(updated) && updated.cup && houseAlive(updated)) {
      const elsewhere = playElsewhere(updated);
      updated = elsewhere.tournament;
      decided = elsewhere.decided;
    }
    setTournament(updated);
    setJustPlayedId(currentMatch.id);
    setElsewhereIds(decided);
    setCurrentMatch(null);
    if (updated.status === "done") setScreen("champion");
    else if (isKnockout(updated) && updated.cup && wasAlive && !houseAlive(updated)) setScreen("eliminated");
    else setScreen("overview");
    await upsertTournament(updated);
    if (updated.status === "done") clearActiveTournamentId();
  }

  /** The house is out and wants to see how it ends: everything left is decided, and the champion is shown. */
  async function handleWatchRest() {
    if (!tournament) return;
    const { tournament: finished } = playElsewhere(tournament);
    setTournament(finished);
    setScreen(finished.status === "done" ? "champion" : "overview");
    await upsertTournament(finished);
    if (finished.status === "done") clearActiveTournamentId();
  }

  /** Takes the latest result back and reopens the match. */
  async function handleUndo() {
    if (!tournament) return;
    const back = isPilot(tournament) ? undoPilotResult(tournament) : undoLastResult(tournament);
    if (!back) return;
    setTournament(back);
    setJustPlayedId(null);
    setElsewhereIds([]);
    setScreen("overview");
    // A cup that was finished was taken off the device when it ended; it is live again.
    saveActiveTournamentId(back.id);
    await upsertTournament(back);
  }

  /** Permanently abandons the tournament (confirmed on the overview first) — unlike a completed
   *  tournament, an aborted one has no value to keep around, so it's deleted outright
   *  rather than just cleared locally. */
  async function handleCancelTournament() {
    if (!tournament || submitting) return;
    setSubmitting(true);
    clearActiveTournamentId();
    await deleteTournament(tournament.id);
    onExitToHome();
  }

  function openHistory(from: "setup" | "overview") {
    setHistoryFrom(from);
    setScreen("history");
  }

  // The big screen shows the champion while this screen is up, and lets go of it when it is left. (The draw sends itself, see DrawScreen.)
  useEffect(() => {
    if (screen !== "champion" || !tournament || tournament.status !== "done") return;
    void publishShow(championShowOf(tournament));
    return () => {
      void publishShow(null);
    };
  }, [screen, tournament]);
  useEffect(() => {
    if (screen !== "draw") return;
    return () => {
      void publishShow(null);
    };
  }, [screen]);

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

  if (screen === "history") {
    return <TournamentHistoryScreen onBack={() => setScreen(historyFrom === "overview" && tournament ? "overview" : "setup")} />;
  }

  if (screen === "setup") {
    return (
      <TournamentSetupScreen
        onBack={onExitToHome}
        onNext={handleSetupNext}
        onHistory={() => openHistory("setup")}
        initialMode={pendingMode}
        initialParticipants={pendingParticipants}
        initialVariant={pendingVariant}
        initialCup={pendingCup}
        initialName={pendingName}
      />
    );
  }

  if (screen === "draw" && pendingMode && pendingParticipants) {
    return <DrawScreen seeded={seededOrder()} cup={pendingCup ?? undefined} summary={[pendingName || pendingCup?.name || "Turnering", String(pendingParticipants.length)].join(" · ")} onBack={() => setScreen("setup")} onStart={createAndOpen} />;
  }

  if (screen === "match" && tournament && currentMatch && matchParticipants(currentMatch).length >= 2) {
    // For a cup against bots the levels are those of this very match: how far into the cup it is, and the bots' form.
    const { botLevels, teamRosters } = botSetupForMatch(tournament, currentMatch);
    return (
      <MikkeMusApp
        initialPlayers={matchParticipants(currentMatch)}
        initialBotLevels={botLevels}
        initialTeamRosters={teamRosters}
        initialVariant={currentMatch.variant ?? tournament.variant ?? "standard"}
        onMatchComplete={handleMatchComplete}
        onExitToHome={handleMatchAbort}
      />
    );
  }

  if (screen === "bulloff" && tournament && currentMatch && ties && ties.groups.length > 0) {
    const group = ties.groups[0];
    const places = group.map((n) => ties.placements.indexOf(n) + 1);
    const sigmas = Object.fromEntries(
      group.map((n) => {
        const p = tournament.participants.find((x) => x.name === n);
        return [n, p?.isBot ? sigmaForLevel(p.botLevel ?? "4") : undefined];
      }),
    );
    return (
      <BullOffScreen
        key={group.join("|")}
        group={group}
        context={`Likt om plass ${places.join(" og ")} i ${currentMatch.pilot?.label ?? "kampen"}`}
        sigmas={sigmas}
        photos={Object.fromEntries(roster.map((r) => [r.name, r.photo]))}
        onDone={(order) => {
          const placements = withGroupOrder(ties.placements, group, order);
          const rest = ties.groups.slice(1);
          if (rest.length === 0) void finishPilotMatch(placements, ties.stats);
          else {
            setTies({ ...ties, placements, groups: rest });
            savePendingTies({ tournamentId: tournament.id, matchId: currentMatch.id, placements, stats: ties.stats, groups: rest });
          }
        }}
      />
    );
  }

  if (screen === "champion" && tournament && tournament.status === "done") {
    return <ChampionScreen tournament={tournament} onNewWithSame={handleNewWithSame} onHome={onExitToHome} onUndo={handleUndo} />;
  }

  if (screen === "eliminated" && tournament) {
    const house = tournament.participants.filter((p) => (p.members ? p.members.some((m) => !m.isBot) : !p.isBot)).map((p) => p.name);
    return <EliminatedScreen tournament={tournament} names={house} onWatchRest={handleWatchRest} onLeave={onExitToHome} />;
  }

  if (tournament && isPilot(tournament)) {
    return (
      <PilotOverview
        tournament={tournament}
        justDecidedId={justPlayedId}
        decidedElsewhere={elsewhereIds}
        onPlayNext={handlePlayNext}
        onExitToHome={onExitToHome}
        onUndo={handleUndo}
        onCancelTournament={handleCancelTournament}
        cancelingTournament={submitting}
        onHistory={() => openHistory("overview")}
      />
    );
  }

  if (tournament && isKnockout(tournament)) {
    return (
      <KnockoutOverview
        tournament={tournament}
        justDecidedId={justPlayedId}
        elsewhereIds={elsewhereIds}
        onPlayNext={handlePlayNext}
        onExitToHome={onExitToHome}
        onUndo={handleUndo}
        onCancelTournament={handleCancelTournament}
        cancelingTournament={submitting}
        onHistory={() => openHistory("overview")}
      />
    );
  }

  if (tournament) {
    // A tournament from before the knockout: groups, then a bracket. It is played to the end as it was started.
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
      onHistory={() => openHistory("setup")}
      initialMode={pendingMode}
      initialParticipants={pendingParticipants}
    />
  );
}
