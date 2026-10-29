import type { CSSProperties } from "react";
import type { Tournament, TournamentMatch } from "@/lib/tournament";
import { seedOf } from "@/lib/knockout";
import type { PlayerRecord } from "@/lib/playerRows";
import { avatarAccent } from "@/lib/avatarAccent";
import type { BotLevel } from "@/lib/botLevels";
import { buildSeedTable } from "@/lib/seedingTable";
import { Avatar } from "./ui/Avatar";
import { SeedBadge } from "./ui/SeedBadge";
import { LevelBars } from "./ui/LevelBars";

export type PosterSide = {
  name: string;
  photo?: string | null;
  bot?: boolean;
  level?: BotLevel;
  /** Seeding, shown as a medal. */
  seed?: number | null;
  /** The rating, shown beside the seeding. */
  rating?: number | null;
  /** Chance of winning, 0 to 1. */
  chance?: number | null;
};

/** The two sides of a match as the poster draws them: face (a photo, or a bot's own), seeding, a bot's level and the chance of winning. */
/** The rating of each name in the roster, as the seeding table has it. */
export function ratingsOf(records: Parameters<typeof buildSeedTable>[0]): Map<string, number> {
  return new Map(buildSeedTable(records, { target: 3, ringChoice: true }).map((r) => [r.name, r.rating]));
}

export function posterSides(t: Tournament, match: TournamentMatch, records: Pick<PlayerRecord, "name" | "photo">[], chance: number | null, ratings?: Map<string, number>): [PosterSide, PosterSide] {
  const sideOf = (name: string, p: number | null): PosterSide => {
    const entrant = t.participants.find((x) => x.name === name);
    return { name, photo: records.find((r) => r.name === name)?.photo, bot: !!entrant?.isBot, level: entrant?.botLevel, seed: seedOf(t, name), rating: ratings?.get(name), chance: p };
  };
  return [sideOf(match.participantA!, chance), sideOf(match.participantB!, chance === null ? null : 1 - chance)];
}

export function Side({ side, large, clean = false }: { side: PosterSide; large: boolean; clean?: boolean }) {
  if (clean) {
    // The quiet card: the face and the name, small, so the match and its button fit on the screen with the bracket under them.
    return (
      <div className="match-side relative" style={{ "--pc": avatarAccent(side.name), padding: "0.8rem 0.4rem 0.6rem" } as CSSProperties}>
        <Avatar name={side.name} photo={side.photo} px={64} bot={side.bot} />
        <p className="font-display w-full line-clamp-2 mt-1 break-words" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)", lineHeight: 1.1 }}>
          {side.name}
        </p>
      </div>
    );
  }
  return (
    <div className="match-side" style={{ "--pc": avatarAccent(side.name), padding: large ? "1.75rem 1rem" : "1rem 0.5rem" } as CSSProperties}>
      <Avatar name={side.name} photo={side.photo} size={large ? "xl" : "l"} bot={side.bot} />
      <p style={{ minHeight: large ? "2.5rem" : "1.75rem" }}>{side.seed ? <SeedBadge seed={side.seed} rating={side.rating} large={large} /> : null}</p>
      <p className="font-display w-full line-clamp-2 break-words" style={{ color: "var(--color-cream)", fontSize: large ? "var(--text-num)" : "var(--text-title)", lineHeight: 1.1 }}>
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
 * of winning, and «mot» between them in the colour of the cup. On the phone the card is quiet: face, name and a seeding tag, with a VS medal
 * between them; the chance of winning is a stripe under it. The same on the phone and, large, on the big screen.
 */
export function MatchPoster({ a, b, tint = "var(--color-teal)", large = false }: { a: PosterSide; b: PosterSide; tint?: string; large?: boolean }) {
  return (
    <div className="flex items-stretch gap-2" role="group" aria-label={`${a.name} mot ${b.name}`}>
      <Side side={a} large={large} clean={!large} />
      {large ? (
        <span className="font-display self-center" style={{ color: tint, fontSize: "var(--text-num)" }}>
          mot
        </span>
      ) : (
        <span className="vs-medal self-center" style={{ "--tint": tint } as CSSProperties} aria-hidden>
          VS
        </span>
      )}
      <Side side={b} large={large} clean={!large} />
    </div>
  );
}
