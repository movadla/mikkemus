import type { PlayerRecord } from "./playerRows";

/**
 * The matches the two sides have played against each other, from what each has on record, as wins for each. Nothing when they have never met: there is no
 * figure to show, and none is made up. A side with no record of its own (a guest, a bot) is read from the other's.
 */
export function headToHead(a: PlayerRecord | undefined, b: PlayerRecord | undefined, nameA: string, nameB: string): [{ wins: number; played: number }, { wins: number; played: number }] | null {
  const against = (rec: PlayerRecord | undefined, other: string) => (rec?.matchHistory ?? []).filter((m) => m.vs?.includes(other));
  const fromA = against(a, nameB);
  if (fromA.length > 0) {
    const won = fromA.filter((m) => m.won).length;
    return [{ wins: won, played: fromA.length }, { wins: fromA.length - won, played: fromA.length }];
  }
  const fromB = against(b, nameA);
  if (fromB.length > 0) {
    const won = fromB.filter((m) => m.won).length;
    return [{ wins: fromB.length - won, played: fromB.length }, { wins: won, played: fromB.length }];
  }
  return null;
}
