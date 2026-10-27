import type { Tournament, TournamentMatch } from "@/lib/tournament";

const sentence = (m: TournamentMatch) => {
  const loser = m.participantA === m.winner ? m.participantB : m.participantA;
  return m.pilot ? { who: m.winner!, rest: ` vant ${m.pilot.label}` } : { who: m.winner!, rest: ` slo ${loser}` };
};

/** The last results of the tournament in a strip along the bottom of the big screen, the newest first, so the screen says what has just happened. */
export function ResultTicker({ tournament }: { tournament: Tournament }) {
  const latest = tournament.matches
    .filter((m) => m.winner && !m.isBye && m.decidedOrder)
    .sort((a, b) => (b.decidedOrder ?? 0) - (a.decidedOrder ?? 0))
    .slice(0, 6);
  if (latest.length === 0) return null;
  return (
    <div className="result-ticker" role="status" aria-label="Siste resultater">
      <span className="result-ticker-label">SISTE</span>
      {latest.map((m) => {
        const s = sentence(m);
        return (
          <span key={m.id} className="result-ticker-item">
            <b>{s.who}</b>
            {s.rest}
          </span>
        );
      })}
    </div>
  );
}
