"use client";

import { useMemo, useState } from "react";
import { bracketRoundLabel, tournamentTitle, type Tournament, type TournamentMatch } from "@/lib/tournament";
import { nextToThrow } from "@/lib/botSim";
import { isHouseName, outIn, placeholderLabel, seedOf, undoableMatch, upcomingFor } from "@/lib/knockout";
import { winChanceFor } from "@/lib/nextUp";
import { useRoster } from "@/lib/storage";
import { BracketTree } from "./BracketTree";
import { ConfirmDialog } from "./ConfirmDialog";
import { ScreenTop } from "./ScreenTop";
import { StepStrip } from "./StepStrip";
import { Avatar } from "./ui/Avatar";
import { CupBanner } from "./CupBanner";

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

/** The match to play next: who, which round, and what the odds say. */
function NextUpCard({ tournament, match, onPlay }: { tournament: Tournament; match: TournamentMatch; onPlay: () => void }) {
  const records = useRoster();
  const chance = useMemo(() => winChanceFor(tournament, match, records), [tournament, match, records]);
  const [a, b] = [match.participantA!, match.participantB!];
  const side = (name: string, p: number | null) => (
    <div className="flex-1 min-w-0 flex flex-col items-center text-center gap-1">
      <Avatar name={name} photo={records.find((r) => r.name === name)?.photo} size="l" state={isHouseName(tournament, name) ? "active" : "idle"} bot={!!tournament.participants.find((p) => p.name === name)?.isBot} />
      <p className="tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
        {seedOf(tournament, name) ? `#${seedOf(tournament, name)}` : ""}
      </p>
      <p className="font-display truncate" style={{ color: isHouseName(tournament, name) ? "var(--color-teal-strong)" : "var(--color-cream)", fontSize: "var(--text-title)" }}>
        {name}
      </p>
      {p !== null && (
        <p className="tabular" style={{ color: "var(--color-gold)", fontSize: "var(--text-body)", fontWeight: 600 }}>
          {Math.round(p * 100)} %
        </p>
      )}
    </div>
  );
  return (
    <div className="card mb-4" style={{ ...card, border: "1px solid var(--color-teal)" }}>
      <p className="section-label mb-3 text-center">NESTE · {roundName(match).toUpperCase()}</p>
      <div className="flex items-center gap-2 mb-3">
        {side(a, chance)}
        <span className="font-display" style={{ color: "var(--color-muted)" }}>
          mot
        </span>
        {side(b, chance === null ? null : 1 - chance)}
      </div>
      {chance !== null && (
        <div className="flex rounded-full overflow-hidden mb-4" style={{ height: "0.35rem", background: "var(--color-cell)" }} role="img" aria-label={`Vinnersjanse: ${a} ${Math.round(chance * 100)} prosent`}>
          <div style={{ width: `${chance * 100}%`, background: "var(--color-teal)" }} />
          <div style={{ flex: 1, background: "var(--color-gold)" }} />
        </div>
      )}
      <button
        type="button"
        onClick={onPlay}
        className={`glossy w-full rounded-xl font-semibold text-lg ${FOCUS_RING}`}
        style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control-lg)" } as React.CSSProperties}
      >
        Start kampen
      </button>
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
                  {seedOf(tournament, n) ? `#${seedOf(tournament, n)} ` : ""}
                  {n}
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
}) {
  const [selected, setSelected] = useState<TournamentMatch | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "undo" | null>(null);
  const next = nextToThrow(tournament);
  const just = justDecidedId ? tournament.matches.find((m) => m.id === justDecidedId && m.winner && !m.isBye) ?? null : null;
  const elsewhere = elsewhereIds.map((id) => tournament.matches.find((m) => m.id === id)).filter((m): m is TournamentMatch => !!m && !!m.winner);
  const undoable = undoableMatch(tournament);
  return (
    <div className="animate-screen-push screen" style={{ background: "var(--color-bg)" }}>
      {confirm === "cancel" && (
        <ConfirmDialog
          message="Slette turneringen?"
          buttons={[
            { label: "Behold", onClick: () => setConfirm(null), background: "var(--color-green)" },
            { label: cancelingTournament ? "Sletter …" : "Slett", onClick: cancelingTournament ? () => {} : onCancelTournament, background: "var(--color-red)" },
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
        <ScreenTop title={tournamentTitle(tournament)} onBack={onExitToHome} right={onHistory ? <button type="button" onClick={onHistory} className={`tactile rounded-lg text-sm px-3 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>Pokaler</button> : undefined} />
        <StepStrip step={2} />
        {tournament.cup && <CupBanner cup={tournament.cup} />}
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
          {next && <NextUpCard key={next.id} tournament={tournament} match={next} onPlay={() => onPlayNext(next)} />}
        </div>
        <div className="card mb-4" style={card}>
          <BracketTree tournament={tournament} nextId={next?.id ?? null} justDecidedId={justDecidedId} onSelect={setSelected} />
        </div>
        <div className="mx-auto space-y-2" style={{ maxWidth: "28rem" }}>
          {undoable && (
            <button type="button" onClick={() => setConfirm("undo")} className={`tactile w-full rounded-lg text-sm ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
              Angre siste resultat
            </button>
          )}
          <button type="button" onClick={() => setConfirm("cancel")} className={`tactile w-full rounded-lg text-sm ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-red)", border: "1px solid var(--color-border)" }}>
            Slett turnering
          </button>
        </div>
      </div>
    </div>
  );
}
