/**
 * The books of the career: every movement of money with the week it happened in and what it was for, so the player can see where it came from
 * and where it went (the last week, and in all). The money itself is still `career.money`; this is only the account of it. A career from before
 * there were books has them from the moment it is next played.
 */
import type { Career } from "./career";
import { lifeOf } from "./careerLife";

export type LedgerKind = "prize" | "fee" | "duel" | "sponsor" | "season" | "training" | "room";

export type LedgerEntry = { week: number; kind: LedgerKind; label: string; amount: number };

/** What each kind is called in the books, in the order they are listed. */
export const LEDGER_KINDS: { kind: LedgerKind; name: string }[] = [
  { kind: "prize", name: "Premier" },
  { kind: "duel", name: "Duellene" },
  { kind: "sponsor", name: "Sponsor" },
  { kind: "season", name: "Sesongpremie" },
  { kind: "training", name: "Trening" },
  { kind: "fee", name: "Innskudd" },
  { kind: "room", name: "Treningsrommet" },
];

const KEEP = 400;

/** Writes a movement of money into the books (the money has already moved). Nothing moved, nothing written. */
export function book(career: Career, kind: LedgerKind, label: string, amount: number): Career {
  if (!amount) return career;
  const week = lifeOf(career).week;
  return { ...career, ledger: [...(career.ledger ?? []), { week, kind, label, amount }].slice(-KEEP) };
}

/** The last week of the books: this week and the one before it, newest first. */
export function lastWeek(career: Career): LedgerEntry[] {
  const week = lifeOf(career).week;
  return [...(career.ledger ?? [])].filter((e) => e.week >= week - 1).reverse();
}

/** What came in and what went out in all, and what each kind made. */
export function totals(career: Career): { income: number; spent: number; byKind: { kind: LedgerKind; name: string; amount: number }[] } {
  const all = career.ledger ?? [];
  const income = all.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const spent = all.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
  const byKind = LEDGER_KINDS.map((k) => ({ ...k, amount: all.filter((e) => e.kind === k.kind).reduce((s, e) => s + e.amount, 0) })).filter((k) => k.amount !== 0);
  return { income, spent, byKind };
}
