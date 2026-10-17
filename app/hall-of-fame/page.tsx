"use client";

import Link from "next/link";
import { useRoster, type MatchHistoryEntry, type PlayerRecord } from "@/lib/storage";
import { avatarAccent } from "@/lib/avatarAccent";
import { formatNightDate, groupNights } from "@/lib/nights";
import { TrophyIcon } from "@/components/icons";
import { ScreenTop } from "@/components/ScreenTop";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

function winPct(p: PlayerRecord): number {
  return p.matchesPlayed === 0 ? 0 : Math.round((p.matchesWon / p.matchesPlayed) * 100);
}

/** Longest win streak anywhere in a player's history, and whether that streak is still
 *  running right now — matchHistory is stored oldest-first (see recordMatchHistory in
 *  lib/storage.ts), so "current" is just the trailing run of wins at the end of the array. */
function winStreaks(history: MatchHistoryEntry[]): { best: number; current: number } {
  let best = 0;
  let running = 0;
  for (const entry of history) {
    running = entry.won ? running + 1 : 0;
    if (running > best) best = running;
  }
  let current = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (!history[i].won) break;
    current++;
  }
  return { best, current };
}

export default function HallOfFamePage() {
  const roster = useRoster();
  // People only in the all-time table; a team's record is on its own page (/spillere), and its
  // nights are in the list below like anyone else's.
  const ranked = roster
    .filter((p) => p.kind !== "team" && p.matchesPlayed > 0)
    .sort((a, b) => winPct(b) - winPct(a) || b.matchesWon - a.matchesWon || b.matchesPlayed - a.matchesPlayed);
  const nights = groupNights(roster);

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Hall of Fame" backHref="/statistikk" backLabel="← Statistikk" />

        {ranked.length === 0 ? (
          <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
            Ingen kamper spilt ennå
          </p>
        ) : (
          <>
            <p className="mb-2 section-label">ALLE TIDER</p>
            <div className="space-y-2 mb-8">
              {ranked.map((p, i) => {
                const streaks = winStreaks(p.matchHistory);
                const rankClass = i === 0 ? "rank-glow-1" : i === 1 ? "rank-glow-2" : i === 2 ? "rank-glow-3" : "shadow-panel";
                return (
                  <div
                    key={p.name}
                    className={`${rankClass} flex items-center gap-4 px-4 rounded-xl`}
                    style={{ minHeight: "3.5rem", ...(i < 3 ? {} : { background: "var(--color-surface)" }) }}
                  >
                    <span
                      className="font-display shrink-0 w-7 flex items-center justify-center"
                      style={{ color: i === 0 ? "var(--color-gold)" : "var(--color-muted)", fontSize: "1.1rem" }}
                    >
                      {i === 0 ? <TrophyIcon className="w-4 h-4" /> : i + 1}
                    </span>
                    <div
                      className="rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ width: "2.25rem", height: "2.25rem", background: "var(--color-cell)", border: "1px solid var(--color-border)" }}
                    >
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span style={{ color: avatarAccent(p.name), fontSize: "0.85rem" }}>{p.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>
                        {p.name}
                      </p>
                      <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                        {p.matchesWon}-{p.matchesPlayed - p.matchesWon} · {p.matchesPlayed} kamper
                        {streaks.current >= 2 && ` · 🔥 ${streaks.current} på rad`}
                        {streaks.best >= 2 && ` · rekord ${streaks.best}`}
                      </p>
                    </div>
                    <span className="tabular shrink-0" style={{ color: "var(--color-teal)", fontSize: "1.1rem", fontWeight: 700 }}>
                      {winPct(p)}%
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="mb-2 section-label">KVELDER</p>
            <div className="space-y-4">
              {nights.map((night) => (
                <Link
                  key={night.date}
                  href={`/kveld/${night.date}`}
                  className={`tactile block shadow-panel rounded-xl p-4 ${FOCUS_RING}`}
                  style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ color: "var(--color-cream)", fontSize: "0.85rem", textTransform: "capitalize" }}>
                      {formatNightDate(night.date)}
                    </p>
                    {night.players[0] && night.players[0].wins > 0 && (
                      <span className="inline-flex items-center gap-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem" }}>
                        <TrophyIcon className="w-3 h-3" />
                        {night.players[0].name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {night.players.map((p) => (
                      <span key={p.name} className="px-2 py-1 rounded-full" style={{ background: "var(--color-surface)", color: "var(--color-cream)", fontSize: "0.75rem" }}>
                        {p.name} <span style={{ color: "var(--color-muted)" }}>{p.wins}-{p.losses}</span>
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
