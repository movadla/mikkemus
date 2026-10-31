/**
 * The statistics of an evening: who was best in each game and in all, hit percentage, and the figures for graphs and for comparing two players
 * or two teams. Worked out from the matches of Kveldsscore (results, and the figures of each person kept with a match since they were added) and
 * from the hit percentages the Mikke Mus matches kept (by match id). What a match has no figures for is left out, not guessed at.
 */
import { mergeFigures, type Fig } from "./nightFigures";
import { NIGHT_GAME_NAMES, comparisonOf, pointsOf, resultOf, tableOf, type NightGame, type NightMatch, type NightSide } from "./nightScore";

/** The hit percentage each side got in a Mikke Mus match, by match id and the name of the side (a player, or a team). */
export type HitMap = Record<string, Record<string, number>>;

/** Where a person's own share in a team's match is kept in the HitMap, next to the sides' (a person and a team may share a name). */
export const memberKey = (name: string): string => `~${name}`;

export type Entity = { kind: "player" | "team"; name: string };

const live = (matches: NightMatch[]): NightMatch[] => matches.filter((m) => !m.deleted);

/** The matches in the order they were played. */
const inOrder = (matches: NightMatch[]): NightMatch[] => [...live(matches)].sort((a, b) => a.at.localeCompare(b.at));

/** The id a Mikke Mus match is told by in the records. */
const hitKey = (m: NightMatch): string | null => (m.source?.kind === "match" ? m.source.id : null);

/** The side an entity played for in a match. */
export const sideOf = (m: NightMatch, e: Entity): NightSide | undefined => m.sides.find((s) => (e.kind === "team" ? s.name === e.name : s.members.includes(e.name)));

const sum = (figs: Fig[]): Fig => mergeFigures(figs.map((f) => ({ x: f }))).x;

/** What an entity made in the matches of a game: the members' figures added together. */
function figuresIn(matches: NightMatch[], e: Entity, games: NightGame[]): Fig | null {
  const figs: Fig[] = [];
  for (const m of live(matches)) {
    if (!games.includes(m.game) || !m.figures) continue;
    const side = sideOf(m, e);
    if (!side) continue;
    const people = e.kind === "team" ? side.members : [e.name];
    for (const p of people) if (m.figures[p]) figs.push(m.figures[p]);
  }
  return figs.length > 0 ? sum(figs) : null;
}

/** The mean hit percentage of an entity in the Mikke Mus matches that kept it, or null. A player's is from the matches they played alone and, where kept, their own darts in a team's. */
export function hitPctOf(matches: NightMatch[], hits: HitMap, e: Entity): number | null {
  const got: number[] = [];
  for (const m of live(matches)) {
    const key = hitKey(m);
    const side = sideOf(m, e);
    if (!key || !side || !hits[key]) continue;
    const v = e.kind === "player" && side.members.length > 1 ? hits[key][memberKey(e.name)] : hits[key][side.name];
    if (typeof v === "number") got.push(v);
  }
  return got.length > 0 ? got.reduce((a, b) => a + b, 0) / got.length : null;
}

export type Award = { key: string; title: string; who: string; value: string; note?: string; kind: "player" | "team" };

const COUNTDOWN: NightGame[] = ["301", "501"];
const round1 = (n: number) => Math.round(n * 10) / 10;

export type NightStats = {
  awards: Award[];
  /** Per game played: who won most of them. */
  perGame: { game: NightGame; name: string; matches: number; leader: { who: string; wins: number } | null }[];
  /** Points after each match, per person, in the order played. */
  progress: { names: string[]; steps: { label: string; points: Record<string, number> }[] };
  /** Wins and losses per person. */
  results: { name: string; wins: number; losses: number }[];
  /** Hit percentage per player and per team, highest first. */
  hits: { name: string; pct: number; kind: "player" | "team" }[];
};

export const playersOf = (matches: NightMatch[]): string[] => [...new Set(live(matches).flatMap((m) => m.sides.flatMap((s) => s.members)))].sort((a, b) => a.localeCompare(b, "no"));
export const teamsOf = (matches: NightMatch[]): string[] => [...new Set(live(matches).flatMap((m) => m.sides.filter((s) => s.members.length > 1).map((s) => s.name)))].sort((a, b) => a.localeCompare(b, "no"));

/** The largest of the entries by `value`, with at least `min`: ties give nothing, since an award for a tie is no award. */
function top<T>(list: T[], value: (t: T) => number, min = 0): T | null {
  const ok = list.filter((t) => value(t) > min);
  if (ok.length === 0) return null;
  const best = Math.max(...ok.map(value));
  const winners = ok.filter((t) => value(t) === best);
  return winners.length === 1 ? winners[0] : null;
}

export function statsOf(matches: NightMatch[], hits: HitMap = {}): NightStats {
  const played = inOrder(matches);
  const players = playersOf(played);
  const teams = teamsOf(played);
  const table = tableOf(played);
  const awards: Award[] = [];
  const add = (a: Omit<Award, "kind"> & { kind?: "player" | "team" }) => awards.push({ kind: "player", ...a });

  const first = table[0];
  if (first && first.points > 0) add({ key: "total", title: "Best totalt", who: first.name, value: `${first.points} poeng`, note: `${first.wins} seiere på ${first.matches} kamper` });
  const steady = top(table.filter((r) => r.matches >= 3), (r) => r.wins / r.matches);
  if (steady) add({ key: "steady", title: "Mest jevn", who: steady.name, value: `${Math.round((steady.wins / steady.matches) * 100)} % seiere`, note: `${steady.wins} av ${steady.matches}` });

  const hit = [
    ...players.map((name) => ({ name, kind: "player" as const, pct: hitPctOf(played, hits, { kind: "player", name }) })),
    ...teams.map((name) => ({ name, kind: "team" as const, pct: hitPctOf(played, hits, { kind: "team", name }) })),
  ].filter((h): h is { name: string; kind: "player" | "team"; pct: number } => h.pct !== null);
  const bestHitPlayer = top(hit.filter((h) => h.kind === "player"), (h) => h.pct);
  if (bestHitPlayer) add({ key: "hit", title: "Høyest treffprosent", who: bestHitPlayer.name, value: `${Math.round(bestHitPlayer.pct)} %`, note: "Mikke Mus" });
  const bestHitTeam = top(hit.filter((h) => h.kind === "team"), (h) => h.pct);
  if (bestHitTeam) add({ key: "hitTeam", title: "Lag med høyest treff", who: bestHitTeam.name, value: `${Math.round(bestHitTeam.pct)} %`, note: "Mikke Mus", kind: "team" });

  const figs = (name: string, games: NightGame[]) => figuresIn(played, { kind: "player", name }, games);
  const withFigs = (games: NightGame[]) => players.map((name) => ({ name, f: figs(name, games) })).filter((x): x is { name: string; f: Fig } => x.f !== null);
  const cd = withFigs(COUNTDOWN);
  const avg = top(cd.filter((x) => x.f.rounds >= 3), (x) => x.f.points / x.f.rounds);
  if (avg) add({ key: "avg", title: "Høyest snitt per runde", who: avg.name, value: String(round1(avg.f.points / avg.f.rounds)), note: "301/501" });
  const bestRound = top(cd, (x) => x.f.best);
  if (bestRound) add({ key: "round", title: "Beste runde", who: bestRound.name, value: String(bestRound.f.best), note: "301/501" });
  const finish = top(cd, (x) => x.f.finish);
  if (finish) add({ key: "finish", title: "Beste utsjekk", who: finish.name, value: String(finish.f.finish), note: "301/501" });
  const s180 = top(cd, (x) => x.f.s180);
  if (s180) add({ key: "s180", title: "Flest 180", who: s180.name, value: String(s180.f.s180) });
  const tons = top(cd, (x) => x.f.tons);
  if (tons) add({ key: "tons", title: "Flest runder på 100+", who: tons.name, value: String(tons.f.tons), note: "301/501" });
  const hs = top(withFigs(["highstriker"]), (x) => x.f.best);
  if (hs) add({ key: "hs", title: "Høyeste runde i Highstriker", who: hs.name, value: String(hs.f.best) });
  const burned = top(withFigs(["lava"]), (x) => x.f.burned);
  if (burned) add({ key: "lava", title: "Flest felt brent i Lava", who: burned.name, value: String(burned.f.burned) });
  const halvit = top(withFigs(["halvit"]), (x) => x.f.points);
  if (halvit) add({ key: "halvit", title: "Flest poeng i Halv It", who: halvit.name, value: String(halvit.f.points) });
  const kills = top(withFigs(["killer"]), (x) => x.f.kills);
  if (kills) add({ key: "killer", title: "Flest drap i Killer", who: kills.name, value: String(kills.f.kills) });

  // Who won most of each game.
  const kinds = [...new Set(played.map((m) => m.game))];
  const perGame = kinds.map((game) => {
    const ms = played.filter((m) => m.game === game);
    const wins = new Map<string, number>();
    for (const m of ms) {
      const order = resultOf(m);
      if (!order) continue;
      const winner = m.sides.find((s) => s.name === order[0]);
      for (const p of winner?.members ?? []) wins.set(p, (wins.get(p) ?? 0) + 1);
    }
    const best = Math.max(0, ...wins.values());
    const leaders = [...wins.entries()].filter(([, v]) => v === best && best > 0);
    return { game, name: NIGHT_GAME_NAMES[game], matches: ms.length, leader: leaders.length === 1 ? { who: leaders[0][0], wins: best } : null };
  });
  const bull = perGame.find((g) => g.game === "bullduel");
  if (bull?.leader) add({ key: "bull", title: "Flest seiere i Bull-duell", who: bull.leader.who, value: String(bull.leader.wins) });

  // Points through the evening.
  const running: Record<string, number> = Object.fromEntries(players.map((p) => [p, 0]));
  const steps = played.map((m) => {
    for (const [p, v] of Object.entries(pointsOf(m))) running[p] = (running[p] ?? 0) + v;
    return { label: NIGHT_GAME_NAMES[m.game], points: { ...running } };
  });

  return {
    awards,
    perGame,
    progress: { names: players, steps },
    results: table.map((r) => ({ name: r.name, wins: r.wins, losses: r.losses })),
    hits: hit.sort((a, b) => b.pct - a.pct),
  };
}

export type Side = {
  entity: Entity;
  matches: number;
  wins: number;
  losses: number;
  /** Points in Kveldsscore: for a player. */
  points: number | null;
  hitPct: number | null;
  /** 301/501. */
  average: number | null;
  best: number;
  finish: number;
  tons: number;
  s180: number;
};

function sideStats(matches: NightMatch[], hits: HitMap, e: Entity): Side {
  const played = live(matches).filter((m) => sideOf(m, e));
  let wins = 0;
  let losses = 0;
  for (const m of played) {
    const order = resultOf(m);
    if (!order) continue;
    if (order[0] === sideOf(m, e)!.name) wins += 1;
    else losses += 1;
  }
  const cd = figuresIn(matches, e, COUNTDOWN);
  return {
    entity: e,
    matches: played.length,
    wins,
    losses,
    points: e.kind === "player" ? played.reduce((s, m) => s + (pointsOf(m)[e.name] ?? 0), 0) : null,
    hitPct: hitPctOf(matches, hits, e),
    average: cd && cd.rounds > 0 ? cd.points / cd.rounds : null,
    best: cd?.best ?? 0,
    finish: cd?.finish ?? 0,
    tons: cd?.tons ?? 0,
    s180: cd?.s180 ?? 0,
  };
}

/** Two players or two teams side by side, with how they did against each other. */
export function compare(matches: NightMatch[], hits: HitMap, a: Entity, b: Entity) {
  let aWon = 0;
  let bWon = 0;
  for (const m of live(matches)) {
    const sa = sideOf(m, a);
    const sb = sideOf(m, b);
    if (!sa || !sb || sa === sb) continue;
    const order = resultOf(m);
    if (!order) continue;
    const pa = order.indexOf(sa.name);
    const pb = order.indexOf(sb.name);
    if (pa === -1 || pb === -1 || pa === pb) continue;
    if (pa < pb) aWon += 1;
    else bWon += 1;
  }
  return { a: sideStats(matches, hits, a), b: sideStats(matches, hits, b), duels: { a: aWon, b: bWon } };
}

/** One person's evening: how the points came, how they did in each game, with whom and against whom. */
export function playerNight(matches: NightMatch[], hits: HitMap, name: string) {
  const played = inOrder(matches).filter((m) => m.sides.some((s) => s.members.includes(name)));
  let points = 0;
  const progress = played.map((m) => ({ label: NIGHT_GAME_NAMES[m.game], points: (points += pointsOf(m)[name] ?? 0) }));
  const games = new Map<NightGame, { wins: number; losses: number }>();
  for (const m of played) {
    const order = resultOf(m);
    if (!order) continue;
    const side = m.sides.find((s) => s.members.includes(name))!;
    const g = games.get(m.game) ?? { wins: 0, losses: 0 };
    if (order[0] === side.name) g.wins += 1;
    else g.losses += 1;
    games.set(m.game, g);
  }
  const c = comparisonOf(matches);
  const together = c.together.filter((t) => t.pair.includes(name)).map((t) => ({ with: t.pair.find((p) => p !== name)!, won: t.won, lost: t.lost }));
  const bestMate = top(together, (t) => t.won - t.lost);
  const against = Object.entries(c.against[name] ?? {}).map(([who, d]) => ({ who, ...d }));
  const mostBeaten = top(against, (d) => d.won - d.lost);
  return {
    stats: sideStats(matches, hits, { kind: "player", name }),
    progress,
    games: [...games.entries()].map(([game, v]) => ({ game, name: NIGHT_GAME_NAMES[game], ...v })),
    bestMate: bestMate ? { name: bestMate.with, won: bestMate.won, lost: bestMate.lost } : null,
    mostBeaten: mostBeaten ? { name: mostBeaten.who, won: mostBeaten.won, lost: mostBeaten.lost } : null,
  };
}
