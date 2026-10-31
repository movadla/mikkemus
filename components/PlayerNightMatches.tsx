"use client";

import { useState } from "react";
import { dayLabel } from "@/lib/formatDate";
import { NIGHT_GAME_MARKS, NIGHT_GAME_NAMES, lineOf, pointsOf, resultOf, type NightMatch } from "@/lib/nightScore";
import { useNightScore } from "@/lib/nightScoreStorage";
import { Section } from "./ui/Section";
import { FOCUS_RING } from "./ui/focus";

const SHOWN = 10;

/** What a match came to for this player: won, lost or drawn (null when they are not in it). */
function resultFor(m: NightMatch, name: string, isTeam: boolean): "won" | "lost" | "draw" | null {
  const side = m.sides.find((s) => (isTeam ? s.name === name : s.members.includes(name)));
  if (!side) return null;
  const order = resultOf(m);
  if (!order) return "draw";
  return order[0] === side.name ? "won" : "lost";
}

/** How many matches the player (or team) has in Kveldsscore, from all evenings, and how they went. */
export function useNightRecord(name: string | undefined, isTeam: boolean): { matches: number; won: number; lost: number } {
  const { matches } = useNightScore();
  const mine = name ? matches.filter((m) => !m.deleted && resultFor(m, name, isTeam) !== null) : [];
  return { matches: mine.length, won: mine.filter((m) => resultFor(m, name!, isTeam) === "won").length, lost: mine.filter((m) => resultFor(m, name!, isTeam) === "lost").length };
}

/**
 * Every match of Kveldsscore the player (or team) is in, from all evenings, newest first: the personal side of the evening score, with the
 * points they got. Matches taken out of the evening are not shown.
 */
export function PlayerNightMatches({ name, isTeam }: { name: string; isTeam: boolean }) {
  const { matches, loaded } = useNightScore();
  const [all, setAll] = useState(false);
  if (!loaded) return null;
  const mine = matches
    .filter((m) => !m.deleted && resultFor(m, name, isTeam) !== null)
    .sort((a, b) => b.at.localeCompare(a.at));
  if (mine.length === 0) return null;
  const won = mine.filter((m) => resultFor(m, name, isTeam) === "won").length;
  const lost = mine.filter((m) => resultFor(m, name, isTeam) === "lost").length;
  const points = isTeam ? null : mine.reduce((sum, m) => sum + (pointsOf(m)[name] ?? 0), 0);
  const shown = all ? mine : mine.slice(0, SHOWN);
  return (
    <Section label="Kamper i Kveldsscore" aside={<span className="tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{won}–{lost}{points !== null && ` · ${points} poeng`}</span>}>
      <ul className="kv-lines" aria-label="Kamper i Kveldsscore">
        {shown.map((m) => {
          const line = lineOf(m);
          const result = resultFor(m, name, isTeam);
          return (
            <li key={m.id}>
              <div className="kv-line">
                <span className="kv-game" aria-hidden>
                  {NIGHT_GAME_MARKS[m.game]}
                </span>
                <span className="kv-text">
                  <b>{line.title}</b>
                  <small>
                    {NIGHT_GAME_NAMES[m.game]} · {dayLabel(m.at)}
                    <span className="kv-tag">{result === "won" ? "Vant" : result === "lost" ? "Tapte" : "Uavgjort"}</span>
                    {line.tag && result !== "draw" && !line.tag.startsWith("Vinner") && <span className="kv-tag">{line.tag}</span>}
                  </small>
                </span>
                {line.score && <span className="kv-score tabular">{line.score}</span>}
                <span aria-hidden />
              </div>
            </li>
          );
        })}
      </ul>
      {mine.length > SHOWN && (
        <button type="button" onClick={() => setAll(!all)} className={`tactile flex items-center justify-center w-full rounded-lg mt-2 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", color: "var(--color-teal)", fontWeight: 700, fontSize: "var(--text-small)" }}>
          {all ? "Vis færre" : `Vis alle ${mine.length}`}
        </button>
      )}
    </Section>
  );
}
