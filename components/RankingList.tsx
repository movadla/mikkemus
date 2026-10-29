"use client";

import { useState } from "react";
import type { Career } from "@/lib/career";
import { NATION } from "@/lib/opponents";
import { lifeOf } from "@/lib/careerLife";
import { peopleOf } from "@/lib/careerWorld";
import { norwayRankOf, playerWorldRank, worldRankFor } from "@/lib/opponentStats";
import { gameOf, statsFor } from "@/lib/careerGame";
import { CharacterFace } from "./CharacterFigure";
import { Avatar } from "./ui/Avatar";

type Row = { name: string; nat: string; world: number; figure: number; me: boolean; /** Places up (positive) or down since the last season, or "ny" for someone who came in since. */ moved?: number | "ny" };

/**
 * The two lists of the career, the world and Norway, with the player where their skill and their points put them and the people they meet around
 * them. The others are the named players: their ranks are fixed, so the lists do not change from one tournament to the next, and the player moves
 * up as the points come in.
 */
export function RankingList({ career }: { career: Career }) {
  const [tab, setTab] = useState<"world" | "nor">("world");
  const settings = gameOf(career.profile);
  const first = (med: number) => statsFor(settings, med)[0];
  const me: Row = { name: career.player, nat: "NOR", world: playerWorldRank(career.skillMed, career.points), figure: first(career.skillMed).value, me: true };
  const snap = lifeOf(career).world.snap;
  const seen = Object.keys(snap).length > 0;
  const rows: Row[] = [...peopleOf(career).map((o) => ({ name: o.name, nat: o.nat, world: worldRankFor(o.name, o.med), figure: first(o.med).value, me: false, moved: !seen ? undefined : snap[o.name] === undefined ? ("ny" as const) : snap[o.name] - worldRankFor(o.name, o.med) })), me].filter((r) => tab === "world" || r.nat === "NOR").sort((a, b) => a.world - b.world || (a.me ? -1 : 1));
  const at = rows.findIndex((r) => r.me);
  const from = Math.max(0, Math.min(rows.length - 9, at - 4));
  const shown = rows.slice(from, from + 9);
  return (
    <div className="space-y-3">
      <div className="seg-tabs" role="tablist" aria-label="Liste">
        {(["world", "nor"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="seg-tab tactile">
            {t === "world" ? "Verden" : "Norge"}
          </button>
        ))}
      </div>
      <ol className="space-y-2" aria-label={tab === "world" ? "Verdensrangering" : "Norgesrangering"}>
        {shown.map((r) => (
          <li key={r.name} className={`rank-row ${r.me ? "rank-row-me" : ""}`} aria-current={r.me ? "true" : undefined}>
            <span className="rank-no tabular">{tab === "world" ? r.world : norwayRankOf(r.world)}</span>
            {r.me ? <CharacterFace id={career.profile.character} px={36} /> : <Avatar name={r.name} bot px={36} />}
            <span className="min-w-0">
              <b className="block truncate">{r.me ? `${r.name} (deg)` : r.name}</b>
              <small>
                {NATION[r.nat] ?? r.nat}
                {r.moved === "ny" && <em className="rank-move rank-move-new"> · ny</em>}
                {typeof r.moved === "number" && r.moved !== 0 && (
                  <em className={`rank-move ${r.moved > 0 ? "rank-move-up" : "rank-move-down"}`}>
                    {" "}
                    · {r.moved > 0 ? "▲" : "▼"} {Math.abs(r.moved)}
                  </em>
                )}
              </small>
            </span>
            <span className="rank-avg tabular">
              {r.figure}
              <small>{first(0).short.toLowerCase()}</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
