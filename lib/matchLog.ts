import type { MatchHistoryEntry, PlayerRecord } from "./playerRows";

/** One side of a match, with what the record kept of it. A side with no record (a bot, a guest) has no entry. */
export type MatchSide = {
  name: string;
  kind: "player" | "team" | "other";
  won: boolean | null;
  entry: MatchHistoryEntry | null;
  members?: string[];
};

export type MatchRow = {
  id: string;
  /** When the result was written, ISO. */
  date: string;
  sides: MatchSide[];
  /** Who won, if it is known. */
  winner: string | null;
  /** Crosses the loser lacked when the winner finished, when both sides kept it. */
  margin: number | null;
  /** The match is one the records say nothing more of than one side's result (the other side is a bot or a guest, or older). */
  partial: boolean;
};

/** Entries written for the same match, by the same flush, are within this many seconds of one another. */
const SAME_MATCH_SECONDS = 15;

type Item = { record: PlayerRecord; entry: MatchHistoryEntry };

/**
 * Every match on record, newest first. The records keep each side's result separately; this puts the sides of
 * one match together: by the match id where there is one, and for the matches from before that by the moment the
 * results were written (every side of a match is written in the same instant). A side that has no record of its
 * own (a bot or a guest) is listed by its name where the other side remembers who it played.
 */
export function buildMatchLog(records: PlayerRecord[]): MatchRow[] {
  const items: Item[] = records.flatMap((r) => r.matchHistory.map((entry) => ({ record: r, entry })));
  const groups = new Map<string, Item[]>();
  const loose: Item[] = [];
  for (const it of items) {
    if (it.entry.matchId) {
      const g = groups.get(it.entry.matchId) ?? [];
      g.push(it);
      groups.set(it.entry.matchId, g);
    } else loose.push(it);
  }
  // The older ones: sorted by time, a new match starts when the gap grows, or the same side turns up twice.
  loose.sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  let cluster: Item[] = [];
  let n = 0;
  const flush = () => {
    if (cluster.length > 0) groups.set(`t${n++}-${cluster[0].entry.date}`, cluster);
    cluster = [];
  };
  for (const it of loose) {
    const last = cluster[cluster.length - 1];
    const gap = last ? (Date.parse(it.entry.date) - Date.parse(last.entry.date)) / 1000 : 0;
    if (last && (gap > SAME_MATCH_SECONDS || cluster.some((c) => c.record.name === it.record.name))) flush();
    cluster.push(it);
  }
  flush();

  const rows: MatchRow[] = [];
  for (const [id, group] of groups) {
    const sides: MatchSide[] = group.map((g) => ({ name: g.record.name, kind: g.record.kind === "team" ? "team" : "player", won: g.entry.won, entry: g.entry, ...(g.record.kind === "team" ? { members: g.record.members } : {}) }));
    // Sides the entries say were played against but that have no record of their own.
    const known = new Set(sides.map((s) => s.name.toLowerCase()));
    for (const g of group) for (const v of g.entry.vs ?? []) if (!known.has(v.toLowerCase())) {
      known.add(v.toLowerCase());
      sides.push({ name: v, kind: "other", won: null, entry: null });
    }
    const winnerSide = sides.find((s) => s.won === true);
    // A side with no record of its own won when the sides that have one all lost.
    const knownSides = sides.filter((s) => s.entry);
    const otherWon = !winnerSide && knownSides.length > 0 && knownSides.every((s) => s.won === false) ? sides.find((s) => s.kind === "other") : undefined;
    const winner = winnerSide?.name ?? otherWon?.name ?? null;
    const loser = sides.find((s) => s.entry && s.won === false);
    rows.push({
      id,
      date: group.map((g) => g.entry.date).sort()[0],
      sides,
      winner,
      margin: winnerSide?.entry && loser?.entry?.left !== undefined ? loser.entry.left : null,
      partial: sides.length < 2 || sides.some((s) => s.kind === "other" || !s.entry),
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
