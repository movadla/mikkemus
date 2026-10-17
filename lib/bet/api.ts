import type { LiveMatchState } from "../liveMatch";
import { supabase } from "../supabaseClient";
import { START_COINS, fairPrice, liabilityFor, potFor, stakeProblem, type BetRow, type BetUser, type LedgerRow, type MatchRow } from "./ledger";

export type Books = { users: BetUser[]; ledger: LedgerRow[]; bets: BetRow[]; matches: MatchRow[] };
export type LoadResult = { ok: true; books: Books } | { ok: false; setupNeeded: boolean; message: string };

type DbError = { code?: string; message: string };

/** The tables have not been made (supabase-setup-bet.sql): PostgREST says so with one of these. */
const isMissingTable = (e: DbError) => e.code === "PGRST205" || e.code === "42P01" || /does not exist|schema cache/i.test(e.message);

const fixBet = (b: BetRow): BetRow => ({ ...b, odds: Number(b.odds) }); // numeric columns may come back as strings

export async function loadBooks(): Promise<LoadResult> {
  if (!supabase) return { ok: false, setupNeeded: false, message: "Ingen kobling til databasen." };
  const [users, ledger, bets, matches] = await Promise.all([
    supabase.from("bet_users").select("*").order("created_at"),
    supabase.from("bet_ledger").select("*").order("created_at"),
    supabase.from("bet_bets").select("*").order("placed_at", { ascending: false }),
    supabase.from("bet_matches").select("*").order("created_at", { ascending: false }).limit(60),
  ]);
  const failed = users.error ?? ledger.error ?? bets.error ?? matches.error;
  if (failed) return { ok: false, setupNeeded: isMissingTable(failed), message: failed.message };
  return {
    ok: true,
    books: {
      users: users.data as BetUser[],
      ledger: ledger.data as LedgerRow[],
      bets: (bets.data as BetRow[]).map(fixBet),
      matches: matches.data as MatchRow[],
    },
  };
}

export type Result<T = unknown> = ({ ok: true } & T) | { ok: false; reason: string };

/** A new person, starting the night with 1 000 coins. */
export async function addUser(name: string, night: number): Promise<Result<{ user: BetUser }>> {
  if (!supabase) return { ok: false, reason: "Ingen kobling til databasen." };
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 24);
  if (!clean) return { ok: false, reason: "Skriv et navn." };
  const { data, error } = await supabase.from("bet_users").insert({ name: clean }).select().single();
  if (error) return { ok: false, reason: /duplicate|unique/i.test(error.message) ? `«${clean}» finnes allerede.` : error.message };
  const user = data as BetUser;
  const start = await supabase.from("bet_ledger").insert({ user_id: user.id, night, delta: START_COINS, reason: "start" });
  if (start.error) {
    await supabase.from("bet_users").delete().eq("id", user.id);
    return { ok: false, reason: start.error.message };
  }
  return { ok: true, user };
}

export async function removeUser(id: string): Promise<Result> {
  if (!supabase) return { ok: false, reason: "Ingen kobling til databasen." };
  const { error } = await supabase.from("bet_users").delete().eq("id", id);
  return error ? { ok: false, reason: error.message } : { ok: true };
}

/** Makes sure /bet has a record of the match, with its sides, so that bets can be decided later even by hand. */
export async function ensureMatch(matchId: string, sides: string[]): Promise<void> {
  if (!supabase) return;
  await supabase.from("bet_matches").upsert({ match_id: matchId, sides, status: "open" }, { onConflict: "match_id", ignoreDuplicates: true });
}

async function freshLive(): Promise<LiveMatchState | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("live_match").select("state").eq("id", "current").maybeSingle();
  return ((data as { state: LiveMatchState | null } | null)?.state ?? null) as LiveMatchState | null;
}

/** Whether bets can be made on the match right now: between turns, on the odds of this turn. */
export function marketOpen(live: LiveMatchState | null): boolean {
  return !!live && live.screen === "game" && !live.winner && !!live.matchId && !!live.odds && live.odds.length > 0 && live.oddsTurn === live.turnToken && live.dartsInTurn === 0;
}

async function balanceOf(userId: string, night: number): Promise<number | null> {
  if (!supabase) return null;
  const rows = await supabase.from("bet_ledger").select("delta").eq("user_id", userId).eq("night", night);
  if (rows.error) return null;
  return (rows.data as { delta: number }[]).reduce((s, r) => s + r.delta, 0);
}

const STALE = "Oddsen har endret seg. Sjekk den nye prisen og prøv igjen.";

/**
 * Puts out a bet: «I back this side with this stake at this price», waiting for someone to take the
 * other side. The price and the turn are checked against the match as it is RIGHT NOW, not as the page
 * last saw it. The stake leaves the balance in the same breath (a ledger row).
 */
export async function offerBet(args: { userId: string; night: number; matchId: string; pick: string; stake: number; shownOdds: number; shownTurn: number }): Promise<Result<{ bet: BetRow }>> {
  if (!supabase) return { ok: false, reason: "Ingen kobling til databasen." };
  const live = await freshLive();
  if (!marketOpen(live) || !live) return { ok: false, reason: "Spillene er stengt akkurat nå. De åpner igjen mellom rundene." };
  if (live.matchId !== args.matchId || live.turnToken !== args.shownTurn) return { ok: false, reason: STALE };
  const raw = live.odds!.find((o) => o.name === args.pick);
  if (!raw) return { ok: false, reason: "Fant ikke laget." };
  const side = { ...raw, odds: fairPrice(raw.p) };
  if (Math.abs(side.odds - args.shownOdds) > 0.001) return { ok: false, reason: STALE };

  const balance = await balanceOf(args.userId, args.night);
  if (balance === null) return { ok: false, reason: "Fikk ikke lest saldoen. Prøv igjen." };
  const problem = stakeProblem(args.stake, balance);
  if (problem === "too-high") return { ok: false, reason: `Du har bare ${balance} mynter.` };
  if (problem !== "none") return { ok: false, reason: "Innsatsen må være et helt tall fra 1 og oppover." };
  const liability = liabilityFor(args.stake, side.odds);
  if (liability < 1) return { ok: false, reason: "Innsatsen er for liten til at noen kan ta imot. Legg inn litt mer." };

  const inserted = await supabase
    .from("bet_bets")
    .insert({ backer_id: args.userId, match_id: args.matchId, pick: args.pick, stake: args.stake, odds: side.odds, liability, turn: live.turnToken, phase: live.turnToken === 0 ? "pre" : "live" })
    .select()
    .single();
  if (inserted.error) return { ok: false, reason: inserted.error.message };
  const bet = fixBet(inserted.data as BetRow);
  const took = await supabase.from("bet_ledger").insert({ user_id: args.userId, night: args.night, delta: -args.stake, reason: "stake", bet_id: bet.id });
  if (took.error) {
    await supabase.from("bet_bets").delete().eq("id", bet.id);
    return { ok: false, reason: took.error.message };
  }
  return { ok: true, bet };
}

/**
 * Takes the other side of an open bet. Only one person can: the bet is changed from «open» to
 * «matched» by whoever gets there first, and the others are told it is gone. Refused if the odds have
 * moved since the bet was put out, since the price was only good for that turn.
 */
export async function takeBet(args: { userId: string; night: number; betId: string }): Promise<Result<{ bet: BetRow }>> {
  if (!supabase) return { ok: false, reason: "Ingen kobling til databasen." };
  const found = await supabase.from("bet_bets").select("*").eq("id", args.betId).maybeSingle();
  if (found.error || !found.data) return { ok: false, reason: "Fant ikke spillet." };
  const bet = fixBet(found.data as BetRow);
  if (bet.status !== "open") return { ok: false, reason: "Noen andre var først, eller spillet er trukket tilbake." };
  if (bet.backer_id === args.userId) return { ok: false, reason: "Du kan ikke ta imot ditt eget spill." };
  const live = await freshLive();
  if (!marketOpen(live) || !live) return { ok: false, reason: "Spillene er stengt akkurat nå. De åpner igjen mellom rundene." };
  if (live.matchId !== bet.match_id || live.turnToken !== bet.turn) return { ok: false, reason: STALE };

  const balance = await balanceOf(args.userId, args.night);
  if (balance === null) return { ok: false, reason: "Fikk ikke lest saldoen. Prøv igjen." };
  if (balance < bet.liability) return { ok: false, reason: `Du må ha ${bet.liability} mynter for å ta imot, og har ${balance}.` };

  const changed = await supabase.from("bet_bets").update({ layer_id: args.userId, status: "matched" }).eq("id", bet.id).eq("status", "open").select();
  if (changed.error) return { ok: false, reason: changed.error.message };
  if (!changed.data || changed.data.length === 0) return { ok: false, reason: "Noen andre var først, eller spillet er trukket tilbake." };
  const took = await supabase.from("bet_ledger").insert({ user_id: args.userId, night: args.night, delta: -bet.liability, reason: "lay", bet_id: bet.id });
  if (took.error) {
    await supabase.from("bet_bets").update({ layer_id: null, status: "open" }).eq("id", bet.id);
    return { ok: false, reason: took.error.message };
  }
  return { ok: true, bet: { ...bet, layer_id: args.userId, status: "matched" } };
}

/** Takes an open bet off the table and gives the stake back. Does nothing if someone has already taken it. */
export async function withdrawBet(bet: BetRow, night: number, status: "cancelled" | "void" = "cancelled"): Promise<boolean> {
  if (!supabase) return false;
  const changed = await supabase.from("bet_bets").update({ status, settled_at: new Date().toISOString() }).eq("id", bet.id).eq("status", "open").select("id");
  if (changed.error || !changed.data || changed.data.length === 0) return false;
  await supabase.from("bet_ledger").insert({ user_id: bet.backer_id, night, delta: bet.stake, reason: "refund", bet_id: bet.id });
  return true;
}

/** Open bets that can no longer be taken, because the odds have moved on or the match is over: stakes come back. */
export async function expireOffers(bets: BetRow[], live: LiveMatchState | null, night: number): Promise<number> {
  let n = 0;
  for (const b of bets) {
    if (b.status !== "open") continue;
    const stale = !live || live.matchId !== b.match_id || live.screen !== "game" || live.turnToken !== b.turn;
    if (stale && (await withdrawBet(b, night))) n++;
  }
  return n;
}

/**
 * Decides every bet on a match. A bet with two sides pays the whole pot to whoever was right; a bet
 * nobody took is simply handed back, and with no winner (a match called off) all stakes come back.
 * Safe to run from several phones at once: a bet is only decided by whoever changes it from its
 * current state, and the ledger refuses a second row of the same kind for the same bet and person.
 */
export async function settleMatch(matchId: string, winner: string | null, night: number): Promise<{ decided: number }> {
  if (!supabase) return { decided: 0 };
  const rows = await supabase.from("bet_bets").select("*").eq("match_id", matchId).in("status", ["open", "matched"]);
  if (rows.error) return { decided: 0 };
  let decided = 0;
  for (const raw of rows.data as BetRow[]) {
    const bet = fixBet(raw);
    if (bet.status === "open") {
      if (await withdrawBet(bet, night)) decided++;
      continue;
    }
    const status = winner === null ? "void" : bet.pick === winner ? "won" : "lost";
    const changed = await supabase.from("bet_bets").update({ status, settled_at: new Date().toISOString() }).eq("id", bet.id).eq("status", "matched").select("id");
    if (changed.error || !changed.data || changed.data.length === 0) continue; // someone else decided it
    decided++;
    const entries: { user_id: string; delta: number; reason: string }[] = [];
    if (status === "void") {
      entries.push({ user_id: bet.backer_id, delta: bet.stake, reason: "refund" });
      if (bet.layer_id) entries.push({ user_id: bet.layer_id, delta: bet.liability, reason: "refund" });
    } else {
      const winnerId = status === "won" ? bet.backer_id : bet.layer_id;
      if (winnerId) entries.push({ user_id: winnerId, delta: bet.stake + bet.liability, reason: "payout" });
    }
    if (entries.length) await supabase.from("bet_ledger").insert(entries.map((e) => ({ ...e, night, bet_id: bet.id })));
  }
  await supabase.from("bet_matches").update({ winner, status: winner === null ? "void" : "done" }).eq("match_id", matchId);
  return { decided };
}

/** A new night: everyone is back on 1 000. The old nights stay in the books. */
export async function newNight(users: BetUser[], night: number): Promise<Result<{ night: number }>> {
  if (!supabase) return { ok: false, reason: "Ingen kobling til databasen." };
  const next = night + 1;
  const { error } = await supabase.from("bet_ledger").insert(users.map((u) => ({ user_id: u.id, night: next, delta: START_COINS, reason: "start" })));
  return error ? { ok: false, reason: error.message } : { ok: true, night: next };
}

export { potFor };
