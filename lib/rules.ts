/**
 * The game variants, and the one currently being played.
 *
 * "Standard" is the game as it has always been: three crosses on every row, a triple or double
 * on your own number a choice between the number and the ring. "1 treff" needs one cross per
 * row; doubles and triples bank D and T wherever they land (a T20 while on 20 is a T, nothing
 * more), the bull is reached once everything else is closed, and a match counts for nothing in
 * the career statistics.
 *
 * Held module-wide rather than threaded through every function: a match is one variant from
 * start to finish, and the rule reaches into ~thirty places (the cap, the active step, what a
 * throw classifies as, the bot's whole planning model, how a mark is drawn). Set it before a
 * match starts or resumes — see MikkeMusApp's startGame and its restore — and every pure
 * function reads it from here. Tests run on "standard" unless they say otherwise.
 */
export type GameVariant = "standard" | "onehit";

export type Rules = {
  variant: GameVariant;
  label: string;
  /** Crosses a row needs to close. */
  target: number;
  /** Whether a double/triple landing on the player's own active number asks "number or ring?".
   *  Off, it is simply a ring cross. */
  ringOnOwnNumberIsChoice: boolean;
  /** Whether a finished match is written to the players' career records. */
  countsForStats: boolean;
};

export const RULES: Record<GameVariant, Rules> = {
  standard: { variant: "standard", label: "Standard", target: 3, ringOnOwnNumberIsChoice: true, countsForStats: true },
  onehit: { variant: "onehit", label: "1 treff", target: 1, ringOnOwnNumberIsChoice: false, countsForStats: false },
};

export const VARIANT_ORDER: GameVariant[] = ["standard", "onehit"];

let current: Rules = RULES.standard;

/** Absent or unknown (a snapshot from before variants existed) means standard. */
export function setGameVariant(variant: GameVariant | null | undefined): void {
  current = (variant && RULES[variant]) || RULES.standard;
}

export function getRules(): Rules {
  return current;
}
