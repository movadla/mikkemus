"use client";

import { useEffect, useMemo, useState } from "react";
import { listFinishedTournaments } from "@/lib/tournamentStorage";
import { cupColor } from "@/lib/botCup";
import { dayLabel } from "@/lib/formatDate";
import { podium, tournamentTitle, type Tournament } from "@/lib/tournament";
import { ChampionScreen } from "./ChampionScreen";
import { ScreenTop } from "./ScreenTop";
import { TrophyIcon } from "./icons";
import { Button } from "./ui/Button";
import { CupEmblem } from "./ui/CupEmblem";
import { EmptyState } from "./ui/EmptyState";
import { Row } from "./ui/Row";
import { Section } from "./ui/Section";
import { SkeletonRows } from "./ui/Skeleton";
import { FOCUS_RING } from "./ui/focus";

/** Cups won by each winner, most first. A cup played for fun against bots counts like any other: it is theirs to show. */
export function trophyCount(tournaments: Tournament[]): { name: string; cups: number }[] {
  const counts = new Map<string, number>();
  for (const t of tournaments) if (t.winner) counts.set(t.winner, (counts.get(t.winner) ?? 0) + 1);
  return [...counts.entries()].map(([name, cups]) => ({ name, cups })).sort((a, b) => b.cups - a.cups || a.name.localeCompare(b.name, "no"));
}

/** Cups a shelf holds before the next one starts. */
const PER_SHELF = 5;

/** One winner's trophies, standing on a shelf: tap one to see how it was won. */
function Shelf({ name, cups, onOpen }: { name: string; cups: Tournament[]; onOpen: (t: Tournament) => void }) {
  const rows: Tournament[][] = [];
  for (let i = 0; i < cups.length; i += PER_SHELF) rows.push(cups.slice(i, i + PER_SHELF));
  return (
    <div className="mb-5">
      <p className="flex items-baseline justify-between gap-3 mb-2">
        <span className="font-display" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
          {name}
        </span>
        <span className="tabular" style={{ color: "var(--color-gold)", fontSize: "var(--text-body)", fontWeight: 700 }}>
          {cups.length}
        </span>
      </p>
      <div style={{ borderRadius: "var(--radius-m)", background: "var(--color-panel)", border: "1px solid var(--color-border)", overflow: "hidden" }}>
        {rows.map((row, r) => (
          <div key={r}>
            <div className="flex items-end gap-1 px-3 pt-3" style={{ minHeight: "4.5rem" }}>
              {row.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpen(t)}
                  aria-label={`${tournamentTitle(t)}, ${dayLabel(t.completedAt ?? t.createdAt)}`}
                  className={`tactile flex flex-col items-center justify-end ${FOCUS_RING}`}
                  style={{ width: "3rem", minHeight: "var(--control-lg)", color: cupColor(t.cup?.kind), background: "transparent", boxShadow: "none" }}
                >
                  <TrophyIcon className="w-9 h-9" />
                </button>
              ))}
            </div>
            {/* The shelf board the trophies stand on. */}
            <div style={{ height: "0.5rem", background: "linear-gradient(to bottom, var(--color-surface-2), var(--color-cell))", borderTop: "1px solid var(--color-hairline)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The trophy cabinet: a shelf for each winner with a trophy for every cup won, and below it every cup that was played to the end, newest first. */
export function TournamentHistoryScreen({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<Tournament[] | null>(null);
  const [open, setOpen] = useState<Tournament | null>(null);
  useEffect(() => {
    let live = true;
    listFinishedTournaments().then((t) => {
      if (live) setList(t);
    });
    return () => {
      live = false;
    };
  }, []);
  const counts = useMemo(() => trophyCount(list ?? []), [list]);

  if (open) return <ChampionScreen tournament={open} onClose={() => setOpen(null)} />;
  return (
    <div className="animate-screen-push screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Pokaler" onBack={onBack} />
        {list === null && <SkeletonRows count={3} />}
        {list !== null && list.length === 0 && <EmptyState icon={<TrophyIcon className="w-6 h-6" />} title="Ingen pokaler ennå" action={<Button variant="primary" onClick={onBack}>Start en turnering</Button>} />}
        {counts.map((c) => (
          <Shelf key={c.name} name={c.name} cups={(list ?? []).filter((t) => t.winner === c.name)} onOpen={setOpen} />
        ))}
        {(list ?? []).length > 0 && (
          <Section label="Alle">
            <div className="space-y-2">
              {(list ?? []).map((t) => {
                const places = podium(t);
                return (
                  <Row
                    key={t.id}
                    onClick={() => setOpen(t)}
                    leading={<span style={{ color: cupColor(t.cup?.kind) }}>{t.cup ? <CupEmblem kind={t.cup.kind} /> : <TrophyIcon className="w-5 h-5" />}</span>}
                    title={t.winner ?? "Turnering"}
                    subtitle={`${t.name ?? t.cup?.trophy ?? "Turnering"} · ${dayLabel(t.completedAt ?? t.createdAt)}${places?.second ? ` · finale mot ${places.second}` : ""}`}
                    tone="gold"
                  />
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
