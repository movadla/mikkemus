"use client";

import { useEffect, useMemo, useState } from "react";
import { listFinishedTournaments } from "@/lib/tournamentStorage";
import { podium, type Tournament } from "@/lib/tournament";
import { ChampionScreen } from "./ChampionScreen";
import { ScreenTop } from "./ScreenTop";
import { TrophyIcon } from "./icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** Cups won by each winner, most first. A cup played for fun against bots counts like any other: it is theirs to show. */
export function trophyCount(tournaments: Tournament[]): { name: string; cups: number }[] {
  const counts = new Map<string, number>();
  for (const t of tournaments) if (t.winner) counts.set(t.winner, (counts.get(t.winner) ?? 0) + 1);
  return [...counts.entries()].map(([name, cups]) => ({ name, cups })).sort((a, b) => b.cups - a.cups || a.name.localeCompare(b.name, "no"));
}

/** The trophy cabinet: every cup that was played to the end, newest first, and who has won most of them. */
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
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Pokalskapet" onBack={onBack} backLabel="← Tilbake" />
        {list === null && <p className="text-center" style={{ color: "var(--color-muted)" }}>Henter pokaler …</p>}
        {list !== null && list.length === 0 && (
          <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
            Ingen ferdigspilte turneringer ennå. Den første pokalen havner her.
          </p>
        )}
        {counts.length > 0 && (
          <section className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
            <p className="section-label mb-2">FLEST POKALER</p>
            <ol className="space-y-1">
              {counts.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3" style={{ color: "var(--color-cream)" }}>
                  <span className="truncate">
                    <span className="tabular" style={{ color: "var(--color-muted)", marginRight: "0.5rem" }}>{i + 1}.</span>
                    {c.name}
                  </span>
                  <span className="flex items-center gap-1 shrink-0" style={{ color: "var(--color-gold)" }}>
                    {Array.from({ length: Math.min(c.cups, 6) }).map((_, k) => (
                      <TrophyIcon key={k} className="w-4 h-4" />
                    ))}
                    <span className="tabular" style={{ marginLeft: "0.25rem" }}>{c.cups}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <div className="space-y-2">
          {(list ?? []).map((t) => {
            const places = podium(t);
            return (
              <button key={t.id} type="button" onClick={() => setOpen(t)} className={`tactile w-full text-left rounded-xl p-4 ${FOCUS_RING}`} style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display" style={{ color: "var(--color-gold)", fontSize: "1.2rem" }}>{t.winner}</span>
                  <span className="tabular shrink-0" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>{(t.completedAt ?? t.createdAt).slice(0, 10)}</span>
                </div>
                <p style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>
                  {t.cup?.trophy ?? "Turnering"}
                  {places?.second ? ` · finale mot ${places.second}` : ""}
                </p>
                <p style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
                  {t.participants.length} {t.mode === "team" ? "lag" : "deltakere"}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
