"use client";

import Link from "next/link";
import { useRoster, type MatchHistoryEntry, type PlayerRecord } from "@/lib/storage";
import { dayLabel } from "@/lib/formatDate";
import { groupNights } from "@/lib/nights";
import { MedalIcon, TrophyIcon } from "./icons";
import { avatarAccent } from "@/lib/avatarAccent";
import { Avatar, MorphAvatar } from "./ui/Avatar";
import { FormCurve } from "./ui/FormCurve";
import { CountUp } from "./ui/CountUp";
import { Button } from "./ui/Button";
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

/** One of the three on the podium: the medal, the picture, the name and the win rate, standing on its step. The winner is the tallest, and the only one lit. */
function PodiumPlace({ p, place }: { p: PlayerRecord; place: 0 | 1 | 2 }) {
  const step = ["3.75rem", "2.5rem", "1.75rem"][place];
  return (
    <div className="flex flex-col min-w-0" style={{ justifyContent: "flex-end" }}>
      <Link
        href={`/spillere/${encodeURIComponent(p.name)}`}
        className="tactile edge flex flex-col items-center gap-1 text-center px-2 pt-3 pb-3 min-w-0"
        style={{
          borderRadius: "var(--radius-m) var(--radius-m) 0 0",
          "--edge-accent": PLACE_COLOR[place],
          "--edge-fill-image": place === 0 ? "linear-gradient(180deg, color-mix(in srgb, var(--color-gold) 22%, var(--color-surface)), var(--color-surface))" : undefined,
          boxShadow: place === 0 ? "var(--glow-gold), var(--elevation-2)" : "var(--elevation-1)",
        } as React.CSSProperties}
      >
        <span style={{ color: PLACE_COLOR[place] }}>
          <MedalIcon className={place === 0 ? "w-8 h-8" : "w-6 h-6"} />
        </span>
        <MorphAvatar name={p.name} photo={p.photo} size={place === 0 ? "xl" : "m"} state={place === 0 ? "winner" : "idle"} />
        <span className="font-display truncate w-full" style={{ color: "var(--color-cream)", fontSize: place === 0 ? "var(--text-title)" : "var(--text-body)" }}>
          {p.name}
        </span>
        <span className="num" style={{ color: PLACE_COLOR[place], fontSize: place === 0 ? "var(--text-num)" : "var(--text-title)", fontWeight: 700 }}>
          <CountUp value={winPct(p)} format={(n) => `${n} %`} />
        </span>
      </Link>
      {/* The step it stands on: higher for the better place, in the colour of the place. */}
      <div
        aria-hidden
        className="flex items-start justify-center font-display"
        style={{ height: step, borderRadius: "0 0 var(--radius-s) var(--radius-s)", background: `linear-gradient(180deg, color-mix(in srgb, ${PLACE_COLOR[place]} 38%, var(--color-surface)), var(--color-surface))`, border: "1px solid var(--color-border)", borderTop: "none", color: PLACE_COLOR[place], fontSize: "var(--text-title)", paddingTop: "0.25rem" }}
      >
        {place + 1}
      </div>
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

  if (ranked.length === 0) return <EmptyState icon={<TrophyIcon className="w-6 h-6" />} title="Ingen kamper spilt ennå" action={<Button href="/" variant="primary">Spill en kamp</Button>} />;

  const top = ranked.slice(0, 3);
  // The winner in the middle, as on a podium.
  const podium = top.length === 3 ? [1, 0, 2] : top.map((_, i) => i);
  return (
    <>
      <div className="grid gap-2 mb-4 items-end" style={{ gridTemplateColumns: `repeat(${top.length}, minmax(0, 1fr))` }}>
        {podium.map((i) => (
          <PodiumPlace key={top[i].name} p={top[i]} place={i as 0 | 1 | 2} />
        ))}
      </div>

      {ranked.length > 3 && (
        <div className="space-y-2 mb-8 stagger">
          {ranked.slice(3).map((p, i) => {
            const streaks = winStreaks(p.matchHistory);
            return (
              <Row
                key={p.name}
                accent={avatarAccent(p.name)}
                leading={
                  <span className="inline-flex items-center gap-2">
                    <span className="font-display w-6 text-center" style={{ color: "var(--color-muted)", fontSize: "var(--text-title)" }}>{i + 4}</span>
                    <Avatar name={p.name} photo={p.photo} size="m" />
                  </span>
                }
                trailing={<FormCurve history={p.matchHistory} />}
                bigValue
                title={p.name}
                subtitle={`${p.matchesWon}-${p.matchesPlayed - p.matchesWon} · ${p.matchesPlayed} kamper${streaks.current >= 2 ? ` · ${streaks.current} på rad` : ""}${streaks.best >= 2 ? ` · rekord ${streaks.best}` : ""}`}
                value={`${winPct(p)} %`}
              />
            );
          })}
        </div>
      )}

      <Section label="Kvelder">
        <div className="space-y-2 wide-list stagger">
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
