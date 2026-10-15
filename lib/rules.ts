/**
 * The game variants, and the one currently being played.
 *
 * A match is described by two choices made at setup:
 *
 *  - How many crosses close a row (`target`, 1–5). Three is "Standard" and the game as it has
 *    always been: a triple or double on your own number is a choice between the number and the
 *    ring. One ("1 treff") is the quick game: doubles and triples bank D and T wherever they
 *    land (a T20 while on 20 is a T, nothing more), the bull is reached once everything else is
 *    closed. Two, four and five are the same game with a shorter or longer row. Only Standard
 *    counts in the career statistics — hit percentage over a different row length is a
 *    different number, and mixing the two would quietly spoil both.
 *  - Whether a team member who lands three counting darts stays on for the team's next turn
 *    ("stå ved 3 tellende piler"). Only means something for team play; individual play ignores it.
 *
 * Both travel as ONE string, `GameVariant`, so every place that already carries "the variant"
 * (the saved match, the spectator snapshot, the tournament row — whose column is plain text and
 * needs no migration) carries both choices without a new field. "standard" and "onehit" are the
 * original names and stay valid; "t2", "t4" and "t5" are the new row lengths; a "+stand" suffix
 * switches the stand rule on.
 *
 * Held module-wide rather than threaded through every function: a match is one variant from
 * start to finish, and the rule reaches into ~thirty places (the cap, the active step, what a
 * throw classifies as, the bot's whole planning model, how a mark is drawn). Set it before a
 * match starts or resumes — see MikkeMusApp's startGame and its restore — and every pure
 * function reads it from here. Tests run on "standard" unless they say otherwise.
 */
export type BaseVariant = "onehit" | "t2" | "standard" | "t4" | "t5";
export type GameVariant = BaseVariant | `${BaseVariant}+stand`;

export type Rules = {
  /** The full key, stand rule included. */
  variant: GameVariant;
  /** The row length alone — what the bot's model and the statistics care about. */
  base: BaseVariant;
  label: string;
  /** Crosses a row needs to close. */
  target: number;
  /** Whether a double/triple landing on the player's own active number asks "number or ring?".
   *  Off, it is simply a ring cross. */
  ringOnOwnNumberIsChoice: boolean;
  /** Whether a finished match is written to the players' career records. */
  countsForStats: boolean;
  /** A team member with three counting darts throws again the next time the team is up. */
  standOnThree: boolean;
};

type BaseRules = Omit<Rules, "variant" | "base" | "standOnThree">;

/** A row of one cross has no "number or ring" question: redirecting pays the same single cross
 *  the ring does. From two up there is something to decide. */
const BASE_RULES: Record<BaseVariant, BaseRules> = {
  onehit: { label: "1 treff", target: 1, ringOnOwnNumberIsChoice: false, countsForStats: false },
  t2: { label: "2 treff", target: 2, ringOnOwnNumberIsChoice: true, countsForStats: false },
  standard: { label: "Standard", target: 3, ringOnOwnNumberIsChoice: true, countsForStats: true },
  t4: { label: "4 treff", target: 4, ringOnOwnNumberIsChoice: true, countsForStats: false },
  t5: { label: "5 treff", target: 5, ringOnOwnNumberIsChoice: true, countsForStats: false },
};

function rulesFor(base: BaseVariant, standOnThree: boolean): Rules {
  return {
    ...BASE_RULES[base],
    base,
    variant: standOnThree ? (`${base}+stand` as GameVariant) : base,
    standOnThree,
  };
}

/** The base variants as plain rules, for labels and targets in a picker. */
export const RULES: Record<BaseVariant, Rules> = {
  onehit: rulesFor("onehit", false),
  t2: rulesFor("t2", false),
  standard: rulesFor("standard", false),
  t4: rulesFor("t4", false),
  t5: rulesFor("t5", false),
};

/** In the order a picker shows them: crosses per row, fewest to most. */
export const VARIANT_ORDER: BaseVariant[] = ["onehit", "t2", "standard", "t4", "t5"];

const STAND_SUFFIX = "+stand";

/**
 * Anything stored or typed — a saved snapshot, a database column, nothing at all — into a valid
 * key. Absent or unknown (a snapshot from before variants existed) means standard; an unknown
 * base with a stand suffix keeps the suffix, which is the half that can still be honoured.
 */
export function normalizeVariant(raw: unknown): GameVariant {
  if (typeof raw !== "string") return "standard";
  const stand = raw.endsWith(STAND_SUFFIX);
  const base = stand ? raw.slice(0, -STAND_SUFFIX.length) : raw;
  const known: BaseVariant = base in BASE_RULES ? (base as BaseVariant) : "standard";
  return stand ? (`${known}${STAND_SUFFIX}` as GameVariant) : known;
}

export function baseOf(variant: GameVariant | null | undefined): BaseVariant {
  const key = normalizeVariant(variant);
  return (key.endsWith(STAND_SUFFIX) ? key.slice(0, -STAND_SUFFIX.length) : key) as BaseVariant;
}

export function hasStandRule(variant: GameVariant | null | undefined): boolean {
  return normalizeVariant(variant).endsWith(STAND_SUFFIX);
}

/** The same row length, with the stand rule switched on or off. */
export function withStandRule(variant: GameVariant | null | undefined, on: boolean): GameVariant {
  const base = baseOf(variant);
  return on ? (`${base}${STAND_SUFFIX}` as GameVariant) : base;
}

/** The same stand rule, on another row length. */
export function withBase(variant: GameVariant | null | undefined, base: BaseVariant): GameVariant {
  return withStandRule(base, hasStandRule(variant));
}

/**
 * Bots play up to three crosses per row. Their whole plan is a table over every state of the
 * board, built synchronously the first time a level is used, and its size grows steeply with the
 * row length. Measured: 0.04 s at one cross, 0.25 s at two, ~1–2 s at three (the standard game,
 * warmed up while the match screen opens), but 6–8 s at four and 15–17 s at five — long enough
 * to freeze the screen with nothing to say why. The setup screens therefore keep bots out of the
 * longer games instead of starting a match that stalls.
 */
export const BOT_MAX_TARGET = 3;

/** Whether bots can play this game — see BOT_MAX_TARGET. */
export function botsSupported(variant: GameVariant | null | undefined): boolean {
  return BASE_RULES[baseOf(variant)].target <= BOT_MAX_TARGET;
}

let current: Rules = RULES.standard;

/** Absent or unknown (a snapshot from before variants existed) means standard. */
export function setGameVariant(variant: GameVariant | null | undefined): void {
  current = rulesFor(baseOf(variant), hasStandRule(variant));
}

export function getRules(): Rules {
  return current;
}

/**
 * Whether a row closed this turn was closed "the hard way": three separate darts, one cross
 * each, starting from nothing. It is drawn as a ring with a dot (see Mark). Only exists at three
 * crosses — a turn is three darts, so a shorter row closes with darts to spare and a longer one
 * cannot be closed from nothing inside a single turn.
 */
export function isPerfectClose(dartsOnStep: number, crossesAfter: number): boolean {
  const { target } = getRules();
  return target === 3 && dartsOnStep === 3 && crossesAfter >= 3;
}
