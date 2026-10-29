import { useState } from "react";
import { cupColor } from "@/lib/botCup";
import { dollars, type Place } from "@/lib/career";
import { TIER_LOOK, foilVars } from "@/lib/materials";
import { medOfLevel } from "@/lib/opponentStats";
import { bracketRoundLabel, matchParticipants, type Tournament, type TournamentMatch } from "@/lib/tournament";
import { FlameIcon } from "./icons";
import { SnowIcon } from "./careerIcons";
import { TrophyArt } from "./CareerTrophy";
import { ChanceMeter, CompareRows, MePortrait, OpponentPortrait, OpponentProfile, type Me } from "./OpponentCard";
import { PlayButton } from "./PlayButton";
import { Sheet } from "./ui/Sheet";
import { ArrowLeftIcon } from "./icons";

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
 * The card before each match of the career: the two of them in frames of metal, and under them what sets them apart: the ranks, the average and
 * how often each hits. The bars grow in, the better of each pair is lit, and the chance of winning comes last. Tapping the opponent opens their
 * profile. A flame by the opponent's name means they are sharp today, a snowflake that they are not.
 */
export function MatchIntro({ tournament, match, player, me, level, opponentLevel, prizes, onStart, onBack }: { tournament: Tournament; match: TournamentMatch; player: string; me: Me; /** The player's level on the bots' scale. */ level: number; opponentLevel: number; prizes: Partial<Record<Place, number>>; onStart: () => void; onBack: () => void }) {
  const [profile, setProfile] = useState(false);
  const [a, b] = matchParticipants(match);
  const opponent = (a === player ? b : a) ?? "";
  const colour = cupColor(tournament.cup?.kind);
  const stake = stakeOf(match.bracketRoundSize ?? 1, prizes);
  // The frame, the foil and the cup in the metal of the event; an event without a material (an open tournament) has none of them.
  const kind = tournament.cup?.kind;
  const tier = kind && kind in TIER_LOOK ? (kind as keyof typeof TIER_LOOK) : null;
  const foil = tier ? (foilVars(tier) as React.CSSProperties) : undefined;
  const form = formWord(level, opponentLevel);
  const med = medOfLevel(opponentLevel);
  return (
    <div className="animate-screen-enter screen cup-lamp" style={{ "--cup": colour } as React.CSSProperties}>
      <div className="screen-inner flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)", gap: "0.9rem" }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Tilbake" className="tactile inline-flex items-center justify-center shrink-0" style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-pill)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <p className="section-label inline-flex items-center gap-2" style={{ color: colour }}>
            {tier && (
              <span className="inline-block" style={{ width: "1.1rem" }}>
                <TrophyArt kind={tier} bare />
              </span>
            )}
            {bracketRoundLabel(match.bracketRoundSize ?? 1, match.isBronzeMatch).toUpperCase()}
          </p>
        </div>
        <div className="flex items-start justify-center gap-3 w-full text-center">
          <div className="final-left" style={{ flex: "1 1 0", minWidth: 0, maxWidth: "9.5rem" }}>
            <MePortrait me={me} />
            <p className={`font-display truncate mt-2 ${tier ? "foil foil-soft" : ""}`} data-t={player} style={{ color: "var(--color-cream)", fontSize: "var(--text-title)", ...foil }}>
              {player}
            </p>
          </div>
          <span className={`final-vs font-display vs-mark ${tier ? "foil" : ""}`} data-t="VS" style={{ color: colour, fontSize: "var(--text-num)", paddingTop: "2.4rem", ...foil }} aria-hidden>
            VS
          </span>
          <div className="final-right" style={{ flex: "1 1 0", minWidth: 0, maxWidth: "9.5rem" }}>
            <OpponentPortrait name={opponent} onClick={() => setProfile(true)} />
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
        <CompareRows me={me} opponent={opponent} med={med} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <ChanceMeter me={me} med={med} />
          {stake.money > 0 && (
            <span className="final-fade inline-flex items-center gap-2 tabular" style={{ "--d": "1.2s", padding: "0.3rem 0.9rem", borderRadius: "var(--radius-pill)", background: "var(--gold-soft)", border: "1px solid var(--color-gold)", color: "var(--color-gold-strong)", fontWeight: 800, fontSize: "var(--text-body)" } as React.CSSProperties}>
              <span className="coin-mark" aria-hidden />
              {dollars(stake.money)}
            </span>
          )}
        </div>
        <PlayButton label="KAST" onClick={onStart} />
      </div>
      {profile && (
        <Sheet title={opponent} onClose={() => setProfile(false)}>
          <OpponentProfile name={opponent} med={med} me={me} />
        </Sheet>
      )}
    </div>
  );
}
