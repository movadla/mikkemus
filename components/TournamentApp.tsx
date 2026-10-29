"use client";

import { useEffect, useState } from "react";
import { matchParticipants, recordMatchResult, type Participant, type Tournament, type TournamentMatch, type TournamentMode } from "@/lib/tournament";
import { createKnockout, houseAlive, isKnockout, seedByStrength, undoLastResult } from "@/lib/knockout";
import { tieGroups, withGroupOrder } from "@/lib/bullOff";
import { createPilot, isPilot, playPilotBots, undoPilotResult } from "@/lib/pilot";
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
import { getFxLevel } from "@/lib/fxLevel";
import { playFanfare, playWinBoom, primeAudio } from "@/lib/fanfare";
import { useRoster } from "@/lib/storage";
import { DartboardGlyph } from "./DartboardGlyph";
import { ChampionScreen } from "./ChampionScreen";
import { BullOffScreen } from "./BullOffScreen";
import { DrawScreen } from "./DrawScreen";
import { PilotOverview } from "./PilotOverview";
import { EliminatedScreen } from "./EliminatedScreen";
import { FinalIntro } from "./FinalIntro";
import { CountdownMatch } from "./CountdownMatch";
import { MatchIntro } from "./MatchIntro";
import type { Me } from "./OpponentCard";
import type { Place } from "@/lib/career";
import { KnockoutOverview } from "./KnockoutOverview";
import { MikkeMusApp } from "./MikkeMusApp";
import { TournamentHistoryScreen } from "./TournamentHistoryScreen";
import { TournamentSetupScreen } from "./TournamentSetupScreen";
import { TournamentOverviewScreen } from "./TournamentOverviewScreen";

/**
 * What the career (lib/career.ts) gives the tournament to run: the draw to make or the cup that is on, and where to send what happens.
 * With it the tournament is not kept with the others (no history, no active-tournament pointer): the career keeps it.
 */
export type CareerHooks = {
  /** The entrants, strongest first, while the draw is still to be made. */
  draw: Participant[] | null;
  cup: CupConfig;
  tournament: Tournament | null;
  /** The cup was made, or a match was played or taken back. */
  onChange: (t: Tournament) => void;
  /** The player is out, or the cup is over: on to the pay-out. */
  onDone: () => void;
  onAbandon: () => void;
  /** What it cost to get in, for the question before giving up. */
  cost: number;
  /** The player's level on the bots' scale, and what each place pays: for the card before a match. */
  level: number;
  prizes: Partial<Record<Place, number>>;
  /** Who the player is in the career, for the card before a match and the profiles. */
  me?: Me;
};

/** The career has no champion screen of its own: when a cup is done the player goes straight on to the pay-out. */
function AutoDone({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the screen comes up
  }, []);
  return null;
}

type Screen = "loading" | "setup" | "draw" | "overview" | "match" | "final" | "bulloff" | "eliminated" | "champion" | "history";

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

export function TournamentApp({ onExitToHome, career }: { onExitToHome: () => void; career?: CareerHooks }) {
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
    if (career) {
      const t = career.tournament;
      if (!t) {
        setPendingMode("individual");
        setPendingParticipants(career.draw);
        setPendingVariant("standard");
        setPendingCup(career.cup);
        setScreen("draw");
        return;
      }
      setTournament(t);
      const resumable = findResumableMatch(t);
      if (t.status === "done") setScreen("champion");
      else if (resumable) {
        setCurrentMatch(resumable);
        setScreen("match");
      } else if (isKnockout(t) && t.cup && !houseAlive(t)) setScreen("eliminated");
      else setScreen("overview");
      return;
    }
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
    // The career is given once, at the start: what it holds later is held here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Where a tournament is kept: with the career when there is one, otherwise with the others. */
  const persist = (t: Tournament) => (career ? Promise.resolve(career.onChange(t)) : upsertTournament(t));
  const markActive = (id: string) => {
    if (!career) saveActiveTournamentId(id);
  };
  const unmarkActive = () => {
    if (!career) clearActiveTournamentId();
  };

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
    markActive(id);
    setScreen("overview");
    await persist(created);
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
    markActive(id);
    setScreen("overview");
    await persist(started);
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
    // Every match of a career has a card before it is thrown, and the final a scene of its own.
    setScreen(career ? "final" : "match");
    // A final and a semi-final have their fanfare. Nothing speaks the names: no voice when a match starts.
    const level = getFxLevel();
    if (level !== "simple" && tournament && isPilot(tournament)) {
      if (level !== "normal" && match.pilot?.stage === "final") {
        primeAudio();
        playFanfare();
      }
    }
    if (level !== "simple" && tournament && isKnockout(tournament)) {
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
    await persist(updated);
    if (updated.status === "done") unmarkActive();
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
    await persist(updated);
    if (updated.status === "done") unmarkActive();
  }

  /** The house is out and wants to see how it ends: everything left is decided, and the champion is shown. */
  async function handleWatchRest() {
    if (!tournament) return;
    const { tournament: finished } = playElsewhere(tournament);
    setTournament(finished);
    setScreen(finished.status === "done" ? "champion" : "overview");
    await persist(finished);
    if (finished.status === "done") unmarkActive();
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
    markActive(back.id);
    await persist(back);
  }

  /** Permanently abandons the tournament (confirmed on the overview first) — unlike a completed
   *  tournament, an aborted one has no value to keep around, so it's deleted outright
   *  rather than just cleared locally. */
  async function handleCancelTournament() {
    if (!tournament || submitting) return;
    if (career) {
      career.onAbandon();
      return;
    }
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
    return <DrawScreen seeded={seededOrder()} cup={pendingCup ?? undefined} summary={[pendingName || pendingCup?.name || "Turnering", String(pendingParticipants.length)].join(" · ")} onBack={() => (career ? onExitToHome() : setScreen("setup"))} onStart={createAndOpen} career={career ? { player: pendingParticipants.find((p) => (p.members ? p.members.some((m) => !m.isBot) : !p.isBot))?.name ?? "", me: career.me } : undefined} />;
  }

  if (screen === "final" && tournament && currentMatch && career) {
    if (currentMatch.bracketRoundSize === 1 && !currentMatch.isBronzeMatch) return <FinalIntro tournament={tournament} match={currentMatch} prizes={career.prizes} onStart={() => setScreen("match")} onBack={() => setScreen("overview")} />;
    const { botLevels, teamRosters } = botSetupForMatch(tournament, currentMatch);
    const names = matchParticipants(currentMatch);
    // The house's own side is the one with a person in it (a team has members); the other is the bot, or the team of bots.
    const isHouse = (n: string) => {
      const p = tournament.participants.find((x) => x.name === n);
      return !!p && (p.members ? p.members.some((m) => !m.isBot) : !p.isBot);
    };
    const mine = names.find(isHouse) ?? names[0];
    const other = names.find((n) => n !== mine) ?? names[1];
    const levelOfSide = (n: string) => (teamRosters[n] ? teamRosters[n].reduce((s, m) => s + Number(m.botLevel ?? 4), 0) / teamRosters[n].length : botLevels[n] !== undefined ? Number(botLevels[n]) : career.level);
    return <MatchIntro tournament={tournament} match={currentMatch} player={mine} me={career.me ?? { name: mine, med: 37, points: 0 }} level={career.level} opponentLevel={levelOfSide(other)} prizes={career.prizes} onStart={() => setScreen("match")} onBack={() => setScreen("overview")} />;
  }

  if (screen === "match" && tournament && currentMatch && matchParticipants(currentMatch).length >= 2) {
    // For a cup against bots the levels are those of this very match: how far into the cup it is, and the bots' form.
    const { botLevels, teamRosters } = botSetupForMatch(tournament, currentMatch);
    // A cup of the career played as 501 or 301: one leg to nothing, not a game of Mikke Mus.
    const countdown = tournament.cup?.countdown;
    if (countdown) {
      return <CountdownMatch key={currentMatch.id} players={matchParticipants(currentMatch)} botLevels={botLevels} teamRosters={teamRosters} start={countdown.start} doubleOut={countdown.doubleOut} humanStart={countdown.humanStart} onDone={handleMatchComplete} onAbort={handleMatchAbort} />;
    }
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
    if (career) return <AutoDone onDone={career.onDone} />;
    return <ChampionScreen tournament={tournament} onNewWithSame={handleNewWithSame} onHome={onExitToHome} onUndo={handleUndo} />;
  }

  if (screen === "eliminated" && tournament) {
    const house = tournament.participants.filter((p) => (p.members ? p.members.some((m) => !m.isBot) : !p.isBot)).map((p) => p.name);
    return <EliminatedScreen tournament={tournament} names={house} onWatchRest={handleWatchRest} onLeave={career ? career.onDone : onExitToHome} leaveLabel={career ? "OK" : undefined} career={!!career} />;
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
        onHistory={career ? undefined : () => openHistory("overview")}
        career={career ? { cost: career.cost } : undefined}
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
