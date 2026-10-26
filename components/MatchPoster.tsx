import type { CSSProperties } from "react";
import type { Tournament, TournamentMatch } from "@/lib/tournament";
import { seedOf } from "@/lib/knockout";
import type { PlayerRecord } from "@/lib/playerRows";
import { avatarAccent } from "@/lib/avatarAccent";
import type { BotLevel } from "@/lib/botLevels";
import { Avatar } from "./ui/Avatar";
import { LevelBars } from "./ui/LevelBars";

export type PosterSide = {
  name: string;
  photo?: string | null;
  bot?: boolean;
  level?: BotLevel;
  /** Seeding, shown as «#3». */
  seed?: number | null;
  /** Chance of winning, 0 to 1. */
  chance?: number | null;
};

/** The two sides of a match as the poster draws them: face (a photo, or a bot's own), seeding, a bot's level and the chance of winning. */
export function posterSides(t: Tournament, match: TournamentMatch, records: Pick<PlayerRecord, "name" | "photo">[], chance: number | null): [PosterSide, PosterSide] {
  const sideOf = (name: string, p: number | null): PosterSide => {
    const entrant = t.participants.find((x) => x.name === name);
    return { name, photo: records.find((r) => r.name === name)?.photo, bot: !!entrant?.isBot, level: entrant?.botLevel, seed: seedOf(t, name), chance: p };
  };
  return [sideOf(match.participantA!, chance), sideOf(match.participantB!, chance === null ? null : 1 - chance)];
}

export function Side({ side, large }: { side: PosterSide; large: boolean }) {
  return (
    <div className="match-side" style={{ "--pc": avatarAccent(side.name), padding: large ? "1.75rem 1rem" : "1rem 0.5rem" } as CSSProperties}>
      <Avatar name={side.name} photo={side.photo} size={large ? "xl" : "l"} bot={side.bot} />
      <p className="tabular" style={{ color: "var(--color-muted)", fontSize: large ? "var(--text-body)" : "var(--text-micro)", minHeight: "1em" }}>
        {side.seed ? `#${side.seed}` : ""}
      </p>
      <p className="font-display w-full truncate" style={{ color: "var(--color-cream)", fontSize: large ? "var(--text-num)" : "var(--text-title)", lineHeight: 1.1 }}>
        {side.name}
      </p>
      {side.bot && side.level && <LevelBars level={side.level} name={side.name} />}
      {side.chance !== null && side.chance !== undefined && (
        <p className="tabular" style={{ color: "var(--color-gold-strong)", fontSize: large ? "var(--text-title)" : "var(--text-body)", fontWeight: 600 }}>
          {Math.round(side.chance * 100)} %
        </p>
      )}
    </div>
  );
}

/** A match of four: the four as cards in two columns, in the order they throw, each with its place in the order on it. */
export function PosterGrid({ sides, large = false }: { sides: PosterSide[]; large?: boolean }) {
  return (
    <ol className="grid grid-cols-2 gap-2" aria-label="Rekkefølgen de kaster i">
      {sides.map((side, i) => (
        <li key={side.name} className="relative flex">
          <span className="absolute z-10 tabular rounded-full flex items-center justify-center" style={{ top: "0.4rem", left: "0.4rem", width: "1.5rem", height: "1.5rem", background: "var(--color-cell)", color: "var(--color-text-2)", fontSize: "var(--text-micro)", fontWeight: 700 }} aria-label={`kaster nummer ${i + 1}`}>
            {i + 1}
          </span>
          <Side side={side} large={large} />
        </li>
      ))}
    </ol>
  );
}

/**
 * The match to play, as a poster: the two sides as cards in their own colours with face, seeding, name, a bot's level and the chance
 * of winning, and «mot» between them in the colour of the cup. The same on the phone and, large, on the big screen.
 */
export function MatchPoster({ a, b, tint = "var(--color-teal)", large = false }: { a: PosterSide; b: PosterSide; tint?: string; large?: boolean }) {
  return (
    <div className="flex items-stretch gap-2" role="group" aria-label={`${a.name} mot ${b.name}`}>
      <Side side={a} large={large} />
      <span className="font-display self-center" style={{ color: tint, fontSize: large ? "var(--text-num)" : "var(--text-body)" }}>
        mot
      </span>
      <Side side={b} large={large} />
    </div>
  );
}
