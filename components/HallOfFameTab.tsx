"use client";

import { useRoster, type MatchHistoryEntry, type PlayerRecord } from "@/lib/storage";
import { avatarAccent } from "@/lib/avatarAccent";
import { dayLabel } from "@/lib/formatDate";
import { groupNights } from "@/lib/nights";
import { MedalIcon, TrophyIcon } from "./icons";
import { EmptyState } from "./ui/EmptyState";
import { Row } from "./ui/Row";
import { Section } from "./ui/Section";

/** Matches a player needs to be ranked among the rest. */
const MIN_MATCHES = 5;

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

/** The colours of the places: gold is earned, silver and bronze are the two below it. */
const PLACE_COLOR = ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"];

function Avatar({ p, size }: { p: PlayerRecord; size: string }) {
  return (
    <span className="rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ width: size, height: size, background: "var(--color-cell)", border: "1px solid var(--color-border)" }}>
      {p.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photo} alt="" className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: avatarAccent(p.name), fontSize: "var(--text-body)" }}>{p.name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

/** One of the three on the podium: the medal, the picture, the name and the win rate. The winner stands highest. */
function PodiumPlace({ p, place }: { p: PlayerRecord; place: 0 | 1 | 2 }) {
  return (
    <div
      className="flex flex-col items-center gap-1 text-center px-2 py-3 min-w-0"
      style={{ borderRadius: "var(--radius-m)", background: place === 0 ? "var(--gold-soft)" : "var(--color-surface)", border: `1px solid ${place === 0 ? "var(--gold-ring)" : "var(--color-border)"}`, marginTop: place === 0 ? 0 : "1.5rem" }}
    >
      <span style={{ color: PLACE_COLOR[place] }}>
        <MedalIcon className="w-6 h-6" />
      </span>
      <Avatar p={p} size={place === 0 ? "3.5rem" : "2.75rem"} />
      <span className="font-display truncate w-full" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)" }}>
        {p.name}
      </span>
      <span className="tabular" style={{ color: PLACE_COLOR[place], fontSize: "var(--text-title)", fontWeight: 700 }}>
        {winPct(p)} %
      </span>
    </div>
  );
}

/** Hall of Fame: who has won most, all time, and the nights they were won on. */
export function HallOfFameTab() {
  const roster = useRoster();
  // People only in the all-time table; a team's record is on its own page (/spillere), and its
  // nights are in the list below like anyone else's.
  const ranked = roster
    .filter((p) => p.kind !== "team" && p.matchesPlayed > 0)
    // Those with too few matches to say anything come after the rest, not first on one lucky win.
    .sort((a, b) => Number(b.matchesPlayed >= MIN_MATCHES) - Number(a.matchesPlayed >= MIN_MATCHES) || winPct(b) - winPct(a) || b.matchesWon - a.matchesWon || b.matchesPlayed - a.matchesPlayed);
  const nights = groupNights(roster);

  if (ranked.length === 0) return <EmptyState icon={<TrophyIcon className="w-6 h-6" />} title="Ingen kamper spilt ennå" />;

  const top = ranked.slice(0, 3);
  // The winner in the middle, as on a podium.
  const podium = top.length === 3 ? [1, 0, 2] : top.map((_, i) => i);
  return (
    <>
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${top.length}, minmax(0, 1fr))` }}>
        {podium.map((i) => (
          <PodiumPlace key={top[i].name} p={top[i]} place={i as 0 | 1 | 2} />
        ))}
      </div>

      {ranked.length > 3 && (
        <div className="space-y-2 mb-8">
          {ranked.slice(3).map((p, i) => {
            const streaks = winStreaks(p.matchHistory);
            return (
              <Row
                key={p.name}
                leading={<span className="font-display w-6 text-center" style={{ color: "var(--color-muted)", fontSize: "var(--text-title)" }}>{i + 4}</span>}
                title={p.name}
                subtitle={`${p.matchesWon}-${p.matchesPlayed - p.matchesWon} · ${p.matchesPlayed} kamper${streaks.current >= 2 ? ` · ${streaks.current} på rad` : ""}${streaks.best >= 2 ? ` · rekord ${streaks.best}` : ""}`}
                value={`${winPct(p)} %`}
              />
            );
          })}
        </div>
      )}

      <Section label="Kvelder">
        <div className="space-y-2">
          {nights.map((night) => {
            const best = night.players[0];
            return (
              <Row
                key={night.date}
                href={`/kveld/${night.date}`}
                title={dayLabel(night.date)}
                subtitle={night.players.map((p) => `${p.name} ${p.wins}-${p.losses}`).join(" · ")}
                value={best && best.wins > 0 ? best.name : undefined}
                tone="default"
              />
            );
          })}
        </div>
      </Section>
    </>
  );
}
