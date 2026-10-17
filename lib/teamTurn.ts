import { DARTS_PER_TURN } from "./game";
import type { TurnAction } from "./turnResolution";

/**
 * How many darts of a turn counted — scored a cross. Darts, not crosses: a triple is one dart
 * worth three crosses, and the stand rule ("stå ved 3 tellende piler") is about the three darts
 * of a turn all being good, not about the crosses they brought.
 *
 * Read off the turn's own action list, which is what Angre and a corrected dart rebuild, so an
 * edited turn is counted as it now stands. A Scolia dart counts when it scored; a manual tap is
 * a dart that counted by definition (the board only offers rows that can still take a cross),
 * and a long-press take-back removes one again.
 */
export function countingDarts(actions: readonly TurnAction[]): number {
  let counted = 0;
  for (const a of actions) {
    if (a.kind === "dart") {
      if (a.scored) counted += 1;
    } else if (a.kind === "tap") {
      counted += 1;
    } else {
      counted = Math.max(0, counted - 1);
    }
  }
  return counted;
}

/**
 * Counting darts in a row at the END of a turn, in the order they were thrown. Only meaningful when
 * every dart of the turn was seen (Scolia): a dart that scored adds one, a dart that did not resets it,
 * a tap adds one and a take-back takes one off. A miss then two hits ends on two, two hits then a miss ends on none.
 */
export function trailingRun(actions: readonly TurnAction[]): number {
  let run = 0;
  for (const a of actions) {
    if (a.kind === "dart") run = a.scored ? run + 1 : 0;
    else if (a.kind === "tap") run += 1;
    else run = Math.max(0, run - 1);
  }
  return run;
}

/** True when the thrower keeps their place for the team's next turn. */
export function standsAfterTurn(standOnThree: boolean, counted: number): boolean {
  return standOnThree && counted >= DARTS_PER_TURN;
}

/**
 * Who throws for the team the next time it is up. Normally the next member in line; with the
 * stand rule and three counting darts, the same one again.
 */
export function nextMemberIndex(current: number, rosterLength: number, stands: boolean): number {
  if (rosterLength <= 0) return 0;
  const here = ((current % rosterLength) + rosterLength) % rosterLength;
  return stands ? here : (here + 1) % rosterLength;
}
