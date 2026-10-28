import { cupColor } from "@/lib/botCup";
import { dollars, type Place } from "@/lib/career";
import { bracketRoundLabel, matchParticipants, type Tournament, type TournamentMatch } from "@/lib/tournament";
import { useRoster } from "@/lib/storage";
import { CareerTip } from "./CareerTip";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { CupEmblem } from "./ui/CupEmblem";

/** The place a player has at least reached once they have won a match of this round (the one they lose in next). */
const FLOOR_AFTER_WIN: Record<number, Place | "winner"> = { 1: "winner", 2: "final", 4: "semi", 8: "quarter", 16: "r16", 32: "r32" };

/** What winning this match is worth: the round it takes the player to, and the least it pays from there. */
export function stakeOf(size: number, prizes: Partial<Record<Place, number>>): { next: string; money: number; title: boolean } {
  const place = FLOOR_AFTER_WIN[size] ?? "r32";
  return { next: size <= 1 ? "pokalen" : bracketRoundLabel(size / 2).toLowerCase(), money: prizes[place] ?? 0, title: size <= 1 };
}

/** How sharp a bot is this match, 0 to 1, from its level on the scale of 1 (sharpest) to 8. */
export const strengthOf = (level: number) => Math.min(1, Math.max(0.08, (9 - level) / 8));

/** A short word for how an opponent stands against the player. */
export function formWord(you: number, opponent: number): string {
  const d = opponent - you;
  if (d <= -1.2) return "Varm i dag";
  if (d >= 1.2) return "Svak i dag";
  return "Jevnbyrdig";
}

/**
 * The card before each match of the career: who is up against whom, how sharp the opponent is today next to the player, and what winning is
 * worth. It is the moment that gives a match something to lose.
 */
export function MatchIntro({ tournament, match, player, level, opponentLevel, prizes, onStart, onBack }: { tournament: Tournament; match: TournamentMatch; player: string; /** The player's level on the bots' scale. */ level: number; opponentLevel: number; prizes: Partial<Record<Place, number>>; onStart: () => void; onBack: () => void }) {
  const roster = useRoster();
  const [a, b] = matchParticipants(match);
  const opponent = a === player ? b : a;
  const colour = cupColor(tournament.cup?.kind);
  const stake = stakeOf(match.bracketRoundSize ?? 1, prizes);
  const photo = (n: string) => roster.find((r) => r.name === n)?.photo;
  const word = formWord(level, opponentLevel);
  const hot = word === "Varm i dag";
  return (
    <div className="animate-screen-enter screen cup-lamp" style={{ "--cup": colour } as React.CSSProperties}>
      <div className="screen-inner flex flex-col items-center text-center" style={{ minHeight: "88dvh", justifyContent: "center", gap: "1.1rem" }}>
        <p className="section-label inline-flex items-center gap-2" style={{ color: colour }}>
          <CupEmblem kind={tournament.cup?.kind ?? "lu"} className="w-4 h-4" />
          {bracketRoundLabel(match.bracketRoundSize ?? 1, match.isBronzeMatch).toUpperCase()} · {(tournament.cup?.name ?? tournament.name ?? "").toUpperCase()}
        </p>
        <div className="flex items-start justify-center gap-3 w-full">
          <div className="final-left" style={{ flex: "1 1 0", minWidth: 0 }}>
            <Avatar name={player} photo={photo(player)} size="xl" state="active" />
            <p className="font-display truncate mt-2" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
              {player}
            </p>
          </div>
          <span className="final-vs font-display" style={{ color: colour, fontSize: "var(--text-title)", paddingTop: "2.2rem" }} aria-hidden>
            VS
          </span>
          <div className="final-right" style={{ flex: "1 1 0", minWidth: 0 }}>
            <Avatar name={opponent} photo={photo(opponent)} size="xl" bot={tournament.participants.find((p) => p.name === opponent)?.isBot} />
            <p className="font-display truncate mt-2" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
              {opponent}
            </p>
          </div>
        </div>
        <div className="w-full">
          <CareerTip id="match">Formen viser hvor skarp motstanderen er i dag, ikke bare generelt. En varm motstander er verdt å ta på alvor.</CareerTip>
        </div>
        <div className="w-full final-fade" style={{ "--d": "1.2s", padding: "0.75rem 0.9rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", textAlign: "left" } as React.CSSProperties}>
          <p className="section-label mb-2">FORM I DAG</p>
          {[
            { name: "Du", value: strengthOf(level), colour: "var(--color-teal)" },
            { name: opponent, value: strengthOf(opponentLevel), colour: hot ? "var(--color-red)" : "var(--color-gold)" },
          ].map((r) => (
            <div key={r.name} className="flex items-center gap-3 mb-1.5">
              <span className="truncate" style={{ width: "5rem", fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                {r.name}
              </span>
              <div className="flex-1" role="progressbar" aria-label={`Form: ${r.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.value * 100)} style={{ height: "0.45rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)", overflow: "hidden" }}>
                <div style={{ width: `${r.value * 100}%`, height: "100%", borderRadius: "var(--radius-pill)", background: r.colour }} />
              </div>
            </div>
          ))}
          <p style={{ fontSize: "var(--text-small)", color: hot ? "var(--color-red)" : "var(--color-muted)", fontWeight: 600 }}>
            {opponent}: {word}
          </p>
        </div>
        <div className="w-full final-fade tabular" style={{ "--d": "1.4s", padding: "0.7rem 0.9rem", borderRadius: "var(--radius-m)", background: "var(--gold-soft)", border: "1px solid var(--color-gold)", color: "var(--color-gold-strong)", fontWeight: 600 } as React.CSSProperties}>
          {stake.title ? `Seier gir pokalen${stake.money > 0 ? ` og ${dollars(stake.money)}` : ""}` : `Seier tar deg til ${stake.next}${stake.money > 0 ? ` og sikrer minst ${dollars(stake.money)}` : ""}`}
        </div>
        <div className="w-full space-y-1 final-fade" style={{ "--d": "1.6s" } as React.CSSProperties}>
          <Button block variant="primary" size="lg" onClick={onStart}>
            Kast ut mot {opponent}
          </Button>
          <button type="button" onClick={onBack} className="tactile w-full" style={{ minHeight: "var(--control)", background: "transparent", color: "var(--color-muted)", textDecoration: "underline", fontSize: "var(--text-small)" }}>
            Tilbake til oversikten
          </button>
        </div>
      </div>
    </div>
  );
}
