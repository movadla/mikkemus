"use client";

import Link from "next/link";
import { formatNightDate, nightAverages, type NightSummary } from "@/lib/nights";
import { TrophyIcon } from "@/components/icons";
import { ScreenTop } from "./ScreenTop";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * Shared rendering for both /kveld (latest night) and /kveld/[dato] (a specific, shareable
 * date) — the two routes only differ in how they pick `night` out of groupNights(), see there.
 */
export function NightDetail({ night, otherDates }: { night: NightSummary | null; otherDates: string[] }) {
  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title={night ? formatNightDate(night.date) : "Kveld"} backHref="/hall-of-fame" backLabel="← Tilbake" />

        {!night ? (
          <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
            Ingen kamper denne kvelden
          </p>
        ) : (
          <>
            {night.players[0] && night.players[0].wins > 0 && (
              <div className="card-gold shadow-panel rounded-xl p-4 mb-4 text-center">
                <p className="font-display" style={{ color: "var(--color-bg)", fontStyle: "italic", fontSize: "0.9rem" }}>
                  Kveldens vinner
                </p>
                <p className="font-display flex items-center justify-center gap-2" style={{ color: "var(--color-bg)", fontSize: "1.6rem" }}>
                  <TrophyIcon className="w-6 h-6" />
                  {night.players[0].name}
                </p>
              </div>
            )}

            <div className="space-y-2 mb-8">
              {night.players.map((p, i) => {
                const stats = nightAverages(p);
                const rankClass = i === 0 ? "rank-glow-1" : i === 1 ? "rank-glow-2" : i === 2 ? "rank-glow-3" : "shadow-panel";
                return (
                  <div
                    key={p.name}
                    className={`${rankClass} rounded-xl px-4 flex items-center justify-between`}
                    style={{ minHeight: "3.5rem", ...(i < 3 ? {} : { background: "var(--color-surface)" }) }}
                  >
                    <div>
                      <p style={{ color: "var(--color-cream)", fontWeight: 600 }}>{p.name}</p>
                      <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                        {p.wins}-{p.losses}
                      </p>
                    </div>
                    <div className="text-right tabular">
                      <p style={{ color: "var(--color-teal)", fontWeight: 700 }}>
                        {stats.hitPct !== null ? `${Math.round(stats.hitPct)}%` : "–"}
                      </p>
                      <p className="section-label" style={{ fontSize: "0.75rem" }}>TREFF</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {otherDates.length > 0 && (
          <>
            <p className="mb-2 section-label">ANDRE KVELDER</p>
            <div className="flex flex-wrap gap-2">
              {otherDates.map((d) => (
                <Link
                  key={d}
                  href={`/kveld/${d}`}
                  className={`tactile inline-flex items-center px-4 rounded-full text-sm ${FOCUS_RING}`}
                  style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                >
                  {d}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
