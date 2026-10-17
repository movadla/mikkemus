/**
 * The books of /bet: play money only, and no bank. Everyone starts a night with 1 000 coins. A bet is
 * between two people: one backs a side with a stake, another takes the other side and risks
 * stake × (odds − 1), and the winner gets the whole pot. Both amounts leave the balances at once.
 * Everything here is arithmetic on rows, with no network, so it can be tested on its own.
 *
 * The balance of a person is never stored; it is the sum of their entries in the ledger. Two phones
 * adding entries at the same moment cannot overwrite each other, which a stored balance would.
 */
export const START_COINS = 1000;

export type BetUser = { id: string; name: string; created_at: string };

export type LedgerReason = "start" | "stake" | "lay" | "payout" | "refund" | "adjust";
export type LedgerRow = { id: string; user_id: string; night: number; delta: number; reason: LedgerReason; bet_id: string | null; created_at: string };

/** open: waiting for someone to take the other side. matched: both sides in. won/lost: from the backer's point of view. */
export type BetStatus = "open" | "matched" | "won" | "lost" | "void" | "cancelled";
export type BetRow = {
  id: string;
  backer_id: string;
  layer_id: string | null;
  match_id: string;
  pick: string;
  stake: number;
  odds: number;
  liability: number;
  turn: number;
  phase: "pre" | "live";
  status: BetStatus;
  placed_at: string;
  settled_at: string | null;
};

export type MatchRow = { match_id: string; sides: string[]; winner: string | null; status: "open" | "done" | "void"; created_at: string };

/** What the other side risks: the backer's profit if the pick wins, whole coins, rounded down. */
export const liabilityFor = (stake: number, odds: number): number => Math.floor(stake * (odds - 1) + 1e-9);

/** What the winner takes home: both stakes. */
export const potFor = (stake: number, odds: number): number => stake + liabilityFor(stake, odds);

/** The night everyone is on now: the highest night in the ledger (1 before anything happens). */
export const currentNight = (ledger: LedgerRow[]): number => ledger.reduce((m, r) => Math.max(m, r.night), 1);

/** Coins per person in one night. */
export function balances(ledger: LedgerRow[], night: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of ledger) if (r.night === night) out[r.user_id] = (out[r.user_id] ?? 0) + r.delta;
  return out;
}

/** How far up or down from the 1 000 each person is on a night. */
export function netByUser(ledger: LedgerRow[], night: number): Record<string, number> {
  const bal = balances(ledger, night);
  const out: Record<string, number> = {};
  for (const [id, b] of Object.entries(bal)) out[id] = b - START_COINS;
  return out;
}

/** Up or down over every night so far, per person. */
export function lifetimeNet(ledger: LedgerRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  const nights = new Set(ledger.map((r) => r.night));
  for (const n of nights) for (const [id, v] of Object.entries(netByUser(ledger, n))) out[id] = (out[id] ?? 0) + v;
  return out;
}

export type Transfer = { from: string; to: string; amount: number };

/**
 * Who owes whom, with the fewest payments. Whoever ended below the start owes whoever ended above
 * it. Every bet is between two people, so the nets add up to zero and, after the transfers, everyone
 * is back to level. Should they not add up (a coin entered by hand), the rest is shared evenly.
 */
export function settleUp(nets: { id: string; net: number }[]): Transfer[] {
  const n = nets.length;
  if (n < 2) return [];
  const total = nets.reduce((s, x) => s + x.net, 0);
  const mean = total / n;
  // Whole-coin positions that add up to zero: floor everyone, then give the remainder to those with the biggest fractions.
  const raw = nets.map((x) => ({ id: x.id, pos: x.net - mean }));
  const floored = raw.map((x) => ({ id: x.id, pos: Math.floor(x.pos), frac: x.pos - Math.floor(x.pos) }));
  let rest = -floored.reduce((s, x) => s + x.pos, 0);
  [...floored].sort((a, b) => b.frac - a.frac).forEach((x) => {
    if (rest > 0) {
      x.pos += 1;
      rest--;
    }
  });
  const debtors = floored.filter((x) => x.pos < 0).map((x) => ({ id: x.id, left: -x.pos })).sort((a, b) => b.left - a.left);
  const creditors = floored.filter((x) => x.pos > 0).map((x) => ({ id: x.id, left: x.pos })).sort((a, b) => b.left - a.left);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (amount > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i++;
    if (creditors[j].left === 0) j++;
  }
  return out;
}

/** Coins tied up in bets that are not decided: the stake when backing, the liability when taking the other side. */
export const atStake = (bets: BetRow[], userId: string): number =>
  bets.reduce((sum, b) => {
    if (b.status === "open" && b.backer_id === userId) return sum + b.stake;
    if (b.status === "matched") return sum + (b.backer_id === userId ? b.stake : b.layer_id === userId ? b.liability : 0);
    return sum;
  }, 0);

export type StakeProblem = "none" | "too-low" | "too-high" | "not-whole";

/** Whether a stake can be placed: whole coins, at least one, no more than the balance. */
export function stakeProblem(stake: number, balance: number): StakeProblem {
  if (!Number.isFinite(stake) || !Number.isInteger(stake)) return "not-whole";
  if (stake < 1) return "too-low";
  if (stake > balance) return "too-high";
  return "none";
}
