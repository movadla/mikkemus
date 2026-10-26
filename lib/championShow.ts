import { awards } from "./knockout";
import type { LiveShow } from "./liveMatch";
import { podium, tournamentTitle, type Tournament } from "./tournament";

export type ChampionShow = Extract<LiveShow, { kind: "champion" }>;

/** What the big screen shows of a finished tournament: the champion, the cup, the prizes and the podium. Sent live from the phone, and
 *  made again by the tournament page of the big screen when it reads a finished cup. */
export function championShowOf(t: Tournament): ChampionShow {
  const places = podium(t);
  const side = t.participants.find((p) => p.name === t.winner);
  return {
    kind: "champion",
    title: tournamentTitle(t),
    cup: t.cup ? { kind: t.cup.kind, name: t.cup.name, trophy: t.cup.trophy } : undefined,
    winner: t.winner ?? "",
    members: side?.members?.map((m) => m.name),
    trophy: t.cup?.trophy,
    prizes: awards(t),
    podium: places ? [places.first, places.second, places.third].filter((n): n is string => !!n) : undefined,
  };
}
