import { cupColor } from "@/lib/botCup";
import { dollars, type Place } from "@/lib/career";
import { bracketRoundLabel, matchParticipants, type Tournament, type TournamentMatch } from "@/lib/tournament";
import { useRoster } from "@/lib/storage";
import { FlameIcon } from "./icons";
import { SnowIcon } from "./careerIcons";
import { PlayButton } from "./PlayButton";
import { Avatar } from "./ui/Avatar";
import { CupEmblem } from "./ui/CupEmblem";
import { ArrowLeftIcon, CoinIcon } from "./icons";

/** The place a player has at least reached once they have won a match of this round (the one they lose in next). */
const FLOOR_AFTER_WIN: Record<number, Place | "winner"> = { 1: "winner", 2: "final", 4: "semi", 8: "quarter", 16: "r16", 32: "r32" };

/** What winning this match is worth: the round it takes the player to, and the least it pays from there. */
export function stakeOf(size: number, prizes: Partial<Record<Place, number>>): { next: string; money: number; title: boolean } {
  const place = FLOOR_AFTER_WIN[size] ?? "r32";
  return { next: size <= 1 ? "pokalen" : bracketRoundLabel(size / 2).toLowerCase(), money: prizes[place] ?? 0, title: size <= 1 };
}

/** How sharp a bot is this match, 0 to 1, from its level on the scale of 1 (sharpest) to 8. */
export const strengthOf = (level: number) => Math.min(1, Math.max(0.08, (9 - level) / 8));

/** How an opponent stands against the player today: hot, even or cold. */
export function formWord(you: number, opponent: number): "hot" | "even" | "cold" {
  const d = opponent - you;
  if (d <= -1.2) return "hot";
  if (d >= 1.2) return "cold";
  return "even";
}

/**
 * The card before each match of the career: the two of them, what winning is worth, and one button. A flame by the opponent's name means
 * they are sharp today, a snowflake that they are not. There is nothing to read, and the moment still has something to lose.
 */
export function MatchIntro({ tournament, match, player, level, opponentLevel, prizes, onStart, onBack }: { tournament: Tournament; match: TournamentMatch; player: string; /** The player's level on the bots' scale. */ level: number; opponentLevel: number; prizes: Partial<Record<Place, number>>; onStart: () => void; onBack: () => void }) {
  const roster = useRoster();
  const [a, b] = matchParticipants(match);
  const opponent = a === player ? b : a;
  const colour = cupColor(tournament.cup?.kind);
  const stake = stakeOf(match.bracketRoundSize ?? 1, prizes);
  const photo = (n: string) => roster.find((r) => r.name === n)?.photo;
  const form = formWord(level, opponentLevel);
  return (
    <div className="animate-screen-enter screen cup-lamp" style={{ "--cup": colour } as React.CSSProperties}>
      <div className="screen-inner flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "1.25rem" }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Tilbake" className="tactile inline-flex items-center justify-center shrink-0" style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-pill)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <p className="section-label inline-flex items-center gap-2" style={{ color: colour }}>
            <CupEmblem kind={tournament.cup?.kind ?? "lu"} className="w-4 h-4" />
            {bracketRoundLabel(match.bracketRoundSize ?? 1, match.isBronzeMatch).toUpperCase()}
          </p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="flex items-start justify-center gap-3 w-full text-center">
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
              <p className="font-display truncate mt-2 inline-flex items-center justify-center gap-1 max-w-full" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                <span className="truncate">{opponent}</span>
                {form === "hot" && (
                  <span role="img" aria-label="Varm i dag" style={{ color: "var(--color-red)" }}>
                    <FlameIcon className="w-5 h-5" />
                  </span>
                )}
                {form === "cold" && (
                  <span role="img" aria-label="Svak i dag" style={{ color: "var(--color-teal)" }}>
                    <SnowIcon className="w-5 h-5" />
                  </span>
                )}
              </p>
            </div>
          </div>
          {stake.money > 0 && (
            <span className="final-fade inline-flex items-center gap-2 tabular" style={{ "--d": "1.2s", padding: "0.4rem 1rem", borderRadius: "var(--radius-pill)", background: "var(--gold-soft)", border: "1px solid var(--color-gold)", color: "var(--color-gold-strong)", fontWeight: 800, fontSize: "var(--text-title)" } as React.CSSProperties}>
              <CoinIcon className="w-5 h-5" />
              {dollars(stake.money)}
            </span>
          )}
        </div>
        <PlayButton label="KAST" onClick={onStart} />
      </div>
    </div>
  );
}
