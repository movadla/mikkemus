/**
 * The merits of a career: things done that are worth a line, read from what the career already holds (no new state), so a career from before
 * there were merits has the ones it has earned. Each is done or not; the profile shows how many, and the list.
 */
import { LADDER, TIERS, type Career } from "./career";
import { RANKS } from "./careerGoals";
import { lifeOf, rivalOf } from "./careerLife";

export type Merit = { id: string; name: string; about: string; done: boolean };

export function meritsOf(career: Career): Merit[] {
  const life = lifeOf(career);
  const rival = rivalOf(career).name;
  const has = (tier: string) => career.trophies.some((t) => t.tier === tier && !t.name);
  const duelWins = career.history.filter((h) => h.game && h.won).length;
  const climb = (career.climb?.level ?? 1) - 1;
  const rankMerit = (i: number) => ({ id: `rank-${i}`, name: RANKS[i].name, about: `${RANKS[i].min} rangpoeng`, done: career.points >= RANKS[i].min });
  const tierMerits = LADDER.map((t) => ({ id: `cup-${t.id}`, name: TIERS[t.id].trophy.replace(/-?pokalen$/, "").replace(/-$/, ""), about: `Vinn ${t.name}`, done: has(t.id) }));
  return [
    { id: "first", name: "Første turnering", about: "Spill en turnering", done: career.played >= 1 },
    { id: "five", name: "Fem turneringer", about: "Spill fem turneringer", done: career.played >= 5 },
    { id: "win", name: "Første seier", about: "Vinn en turnering", done: career.titles >= 1 },
    ...tierMerits,
    rankMerit(1),
    rankMerit(2),
    rankMerit(3),
    { id: "rival", name: "Slått rivalen", about: "Vinn mot rivalen", done: (career.rivals?.[rival]?.w ?? 0) >= 1 },
    { id: "duel", name: "Duellist", about: "Vinn en duell", done: duelWins >= 1 },
    { id: "year", name: "Årets spiller", about: "Bli nummer 1 i en sesong", done: life.seasons.some((s) => s.rank === 1) },
    { id: "climb10", name: "Stigen: 10 nivåer", about: "Kom til nivå 11", done: climb >= 10 },
    { id: "climb50", name: "Stigen: 50 nivåer", about: "Kom til nivå 51", done: climb >= 50 },
    { id: "streak", name: "Fem dager på rad", about: "Bestå dagens øvelse fem dager på rad", done: (career.daily?.streak ?? 0) >= 5 },
    { id: "room", name: "Drømmerommet", about: "Bygg treningsrommet helt ut", done: career.room >= 9 },
  ];
}
