"use client";

import { useMemo, useState } from "react";
import { bracketRoundLabel, tournamentTitle, type Tournament, type TournamentMatch } from "@/lib/tournament";
import { isSimulable, nextToThrow } from "@/lib/botSim";
import { cupColor } from "@/lib/botCup";
import { dollars } from "@/lib/career";
import { MoreIcon } from "./icons";
import { outIn, placeholderLabel, seedOf, undoableMatch, upcomingFor } from "@/lib/knockout";
import { winChanceFor } from "@/lib/nextUp";
import { useRoster } from "@/lib/storage";
import { BracketTree } from "./BracketTree";
import { ConfirmDialog } from "./ConfirmDialog";
import { ScreenTop } from "./ScreenTop";
import { StageStrip } from "./StageStrip";
import { MatchPoster, posterSides, ratingsOf } from "./MatchPoster";
import { CupLine } from "./CupLine";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const card = { background: "var(--color-panel)", border: "1px solid var(--color-border)" } as const;

export function roundName(m: TournamentMatch): string {
  return m.isBronzeMatch ? "Bronsefinale" : bracketRoundLabel(m.bracketRoundSize ?? 1);
}

const hitPct = (s?: { hits: number; misses: number }) => (s && s.hits + s.misses > 0 ? Math.round((s.hits / (s.hits + s.misses)) * 100) : null);

/** What the match that was just decided ended as, and where the winner goes now. */
function ResultCard({ tournament, match }: { tournament: Tournament; match: TournamentMatch }) {
  const winner = match.winner!;
  const loser = match.participantA === winner ? match.participantB : match.participantA;
  const nextOne = match.isBronzeMatch || match.bracketRoundSize === 1 ? null : upcomingFor(tournament, winner);
  const opponent = nextOne ? (nextOne.participantA === winner ? nextOne.participantB : nextOne.participantA) : null;
  const waitingFor = nextOne && !opponent ? placeholderLabel(tournament, nextOne, nextOne.participantA === winner ? "B" : "A") : null;
  const row = (name: string | null) => {
    if (!name) return null;
    const s = match.stats?.[name];
    const pct = hitPct(s);
    return (
      <div className="flex items-baseline justify-between gap-3" style={{ color: name === winner ? "var(--color-gold)" : "var(--color-muted)" }}>
        <span className="truncate font-display" style={{ fontSize: name === winner ? "var(--text-title)" : "var(--text-body)" }}>
          {name}
        </span>
        <span className="tabular shrink-0" style={{ fontSize: "var(--text-small)" }}>
          {s ? `${s.darts} piler` : ""}
          {pct !== null ? ` · ${pct} % treff` : ""}
        </span>
      </div>
    );
  };
  return (
    <div className="card mb-4" style={{ ...card, border: "1px solid var(--color-teal)" }}>
      <p className="section-label mb-3">RESULTAT · {roundName(match).toUpperCase()}</p>
      <div className="space-y-1 mb-3">
        {row(winner)}
        {row(loser)}
      </div>
      {match.isBronzeMatch ? (
        <p style={{ color: "var(--color-cream)", fontSize: "var(--text-body)" }}>{winner} tar bronsen.</p>
      ) : match.bracketRoundSize === 1 ? null : (
        <p style={{ color: "var(--color-cream)", fontSize: "var(--text-body)" }}>
          {winner} går videre til {nextOne ? roundName(nextOne).toLowerCase() : "neste runde"}
          {opponent ? <>, mot {opponent}.</> : waitingFor ? <>, der de møter {waitingFor.toLowerCase()}.</> : "."}
        </p>
      )}
    </div>
  );
}

/** The matches after the next one that someone of the house is in, in the order they come (the bots' own matches play themselves). */
export function queueAfter(t: Tournament, next: TournamentMatch | null): TournamentMatch[] {
  return t.matches.filter((m) => !m.winner && !!m.participantA && !!m.participantB && m.id !== next?.id && !isSimulable(t, m));
}

/** The match to play next as a poster: who, which round, what the odds say, and the matches that follow. */
function NextUpCard({ tournament, match, queue, onPlay }: { tournament: Tournament; match: TournamentMatch; queue: TournamentMatch[]; onPlay: () => void }) {
  const records = useRoster();
  const chance = useMemo(() => winChanceFor(tournament, match, records), [tournament, match, records]);
  const ratings = useMemo(() => ratingsOf(records), [records]);
  const [sideA, sideB] = posterSides(tournament, match, records, chance, ratings);
  return (
    <div className="card mb-4" style={{ ...card, border: "1px solid var(--color-teal)" }}>
      <p className="section-label mb-3 text-center">NESTE · {roundName(match).toUpperCase()}</p>
      <div className="mb-3">
        <MatchPoster a={sideA} b={sideB} tint={cupColor(tournament.cup?.kind)} />
      </div>
      <button
        type="button"
        onClick={onPlay}
        className={`glossy w-full rounded-xl font-semibold text-lg ${FOCUS_RING}`}
        style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control-lg)" } as React.CSSProperties}
      >
        Start kampen
      </button>
      {queue.length > 0 && (
        <div className="mt-4">
          <p className="section-label mb-2">DERETTER</p>
          <ol className="space-y-1">
            {queue.slice(0, 4).map((m, i) => (
              <li key={m.id} className="flex items-center gap-2" style={{ fontSize: "var(--text-body)", color: "var(--color-cream)" }}>
                <span className="tabular shrink-0 text-center" style={{ width: "1.25rem", color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate">
                  {m.participantA} mot {m.participantB}
                </span>
                <span className="shrink-0" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                  {roundName(m)}
                </span>
              </li>
            ))}
          </ol>
          {queue.length > 4 && <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)", marginTop: "0.25rem" }}>og {queue.length - 4} til</p>}
        </div>
      )}
    </div>
  );
}

/** What is known about one match of the bracket, from a tap on its box. */
function MatchSheet({ tournament, match, onClose }: { tournament: Tournament; match: TournamentMatch; onClose: () => void }) {
  const names = [match.participantA, match.participantB].filter((n): n is string => !!n);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={roundName(match)} style={{ background: "var(--scrim)" }}>
      <button type="button" aria-label="Lukk" onClick={onClose} className="absolute inset-0 w-full h-full" />
      <div className="relative w-full max-w-sm rounded-2xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <p className="section-label mb-3">{roundName(match).toUpperCase()}</p>
        <div className="space-y-2 mb-3">
          {names.map((n) => {
            const s = match.stats?.[n];
            const pct = hitPct(s);
            const out = outIn(tournament, n);
            return (
              <div key={n} className="flex items-baseline justify-between gap-3" style={{ color: match.winner === n ? "var(--color-gold)" : "var(--color-cream)" }}>
                <span className="font-display truncate" style={{ fontSize: "var(--text-title)" }}>
                  {n}
                  {seedOf(tournament, n) ? ` (${seedOf(tournament, n)})` : ""}
                </span>
                <span className="tabular shrink-0" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                  {s ? `${s.darts} piler${pct !== null ? ` · ${pct} %` : ""}` : out && !match.winner ? `ute i ${roundName(out).toLowerCase()}` : ""}
                </span>
              </div>
            );
          })}
        </div>
        <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
          {match.isBye ? "Walkover" : match.winner ? `${match.winner} vant` : ""}
        </p>
        <button type="button" onClick={onClose} className={`tactile w-full rounded-lg mt-4 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-cell)", color: "var(--color-cream)" }}>
          Lukk
        </button>
      </div>
    </div>
  );
}

/**
 * The tournament between matches: the result of the match that was just played, the ones that were settled elsewhere, the card for
 * the next match and the bracket itself, with the winner moving on in it.
 */
export function KnockoutOverview({
  tournament,
  justDecidedId,
  elsewhereIds,
  onPlayNext,
  onExitToHome,
  onUndo,
  onCancelTournament,
  cancelingTournament,
  onHistory,
  career,
}: {
  tournament: Tournament;
  justDecidedId: string | null;
  /** Matches the model decided since the last one was thrown. */
  elsewhereIds: string[];
  onPlayNext: (match: TournamentMatch) => void;
  onExitToHome: () => void;
  onUndo: () => void;
  onCancelTournament: () => void;
  cancelingTournament: boolean;
  onHistory?: () => void;
  /** In the career: giving up costs the entry fee, there is no trophy cabinet, and nothing is deleted. */
  career?: { cost: number };
}) {
  const [selected, setSelected] = useState<TournamentMatch | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "undo" | null>(null);
  const next = nextToThrow(tournament);
  const just = justDecidedId ? tournament.matches.find((m) => m.id === justDecidedId && m.winner && !m.isBye) ?? null : null;
  const elsewhere = elsewhereIds.map((id) => tournament.matches.find((m) => m.id === id)).filter((m): m is TournamentMatch => !!m && !!m.winner);
  const undoable = undoableMatch(tournament);
  return (
    <div className="animate-screen-push screen cup-lamp" style={{ "--cup": cupColor(tournament.cup?.kind) } as React.CSSProperties}>
      {confirm === "cancel" && (
        <ConfirmDialog
          message={career ? (career.cost > 0 ? `Gi opp? Du mister innskuddet på ${dollars(career.cost)}.` : "Gi opp turneringen? Kampene som er spilt teller ikke.") : "Slette turneringen?"}
          buttons={[
            { label: career ? "Spill videre" : "Behold", onClick: () => setConfirm(null), background: "var(--color-green)" },
            { label: career ? "Gi opp" : cancelingTournament ? "Sletter …" : "Slett", onClick: cancelingTournament ? () => {} : onCancelTournament, background: "var(--color-red)" },
          ]}
        />
      )}
      {confirm === "undo" && undoable && (
        <ConfirmDialog
          message={`Angre ${undoable.participantA} mot ${undoable.participantB}?`}
          buttons={[
            { label: "Behold", onClick: () => setConfirm(null), background: "var(--color-green)" },
            { label: "Angre", onClick: () => { setConfirm(null); onUndo(); }, background: "var(--color-red)" },
          ]}
        />
      )}
      {selected && <MatchSheet tournament={tournament} match={selected} onClose={() => setSelected(null)} />}
      <div className="screen-inner" style={{ maxWidth: "min(100%, 64rem)" }}>
        <ScreenTop title={tournamentTitle(tournament)} sub={tournament.cup ? <CupLine cup={tournament.cup} /> : undefined} onBack={onExitToHome} right={career ? <button type="button" onClick={() => setConfirm("cancel")} aria-label="Meny" className={`tactile inline-flex items-center justify-center ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}><MoreIcon className="w-5 h-5" /></button> : onHistory ? <button type="button" onClick={onHistory} className={`tactile rounded-lg text-sm px-3 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>Pokaler</button> : undefined} />
        <StageStrip tournament={tournament} />
        <div className="mx-auto" style={{ maxWidth: "28rem" }}>
          {just && <ResultCard tournament={tournament} match={just} />}
          {elsewhere.length > 0 && (
            <div className="card mb-4" style={card}>
              <p className="section-label mb-2">ANDRE KAMPER</p>
              <div className="space-y-1">
                {elsewhere.map((m) => (
                  <p key={m.id} className="flex justify-between gap-3" style={{ fontSize: "var(--text-body)" }}>
                    <span className="truncate" style={{ color: "var(--color-cream)" }}>
                      <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>{m.winner}</span> slo {m.participantA === m.winner ? m.participantB : m.participantA}
                    </span>
                    <span style={{ color: "var(--color-muted)" }} className="shrink-0">
                      {roundName(m)}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}
          {next && <NextUpCard key={next.id} tournament={tournament} match={next} queue={queueAfter(tournament, next)} onPlay={() => onPlayNext(next)} />}
        </div>
        <div className="card mb-4" style={card}>
          <BracketTree tournament={tournament} nextId={next?.id ?? null} justDecidedId={justDecidedId} onSelect={setSelected} />
        </div>
        <div className="mx-auto space-y-2" style={{ maxWidth: "28rem" }}>
          {undoable && (
            <button type="button" onClick={() => setConfirm("undo")} className={`tactile w-full rounded-lg text-sm ${FOCUS_RING}`} style={career ? { minHeight: "var(--control)", background: "transparent", color: "var(--color-muted)", textDecoration: "underline" } : { minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
              Angre siste resultat
            </button>
          )}
          {!career && (
            <button type="button" onClick={() => setConfirm("cancel")} className={`tactile w-full rounded-lg text-sm ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-red)", border: "1px solid var(--color-border)" }}>
              Slett turnering
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
