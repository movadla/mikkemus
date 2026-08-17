"use client";

import Link from "next/link";
import { formatNightDate, nightAverages, type NightSummary } from "@/lib/nights";
import { TrophyIcon } from "@/components/icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * Shared rendering for both /kveld (latest night) and /kveld/[dato] (a specific, shareable
 * date) — the two routes only differ in how they pick `night` out of groupNights(), see there.
 */
export function NightDetail({ night, otherDates }: { night: NightSummary | null; otherDates: string[] }) {
  return (
    <div className="animate-screen-enter min-h-screen w-full p-4" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 pt-2">
          <Link href="/hall-of-fame" className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}>
            ← Hall of Fame
          </Link>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.2rem" }}>
            Kveldens oppsummering
          </h1>
          <div style={{ width: "72px" }} />
        </div>

        {!night ? (
          <p className="text-center py-10" style={{ color: "var(--color-muted)" }}>
            Ingen kamper spilt denne kvelden.
          </p>
        ) : (
          <>
            <p className="text-center mb-6 font-display" style={{ color: "var(--color-cream)", fontSize: "1.2rem", textTransform: "capitalize" }}>
              {formatNightDate(night.date)}
            </p>

            {night.players[0] && night.players[0].wins > 0 && (
              <div className="card-gold shadow-panel rounded-xl p-5 mb-6 text-center">
                <p className="font-display" style={{ color: "var(--color-bg)", fontStyle: "italic", fontSize: "0.9rem" }}>
                  Kveldens vinner
                </p>
                <p className="font-display flex items-center justify-center gap-2" style={{ color: "var(--color-bg)", fontSize: "1.6rem" }}>
                  <TrophyIcon className="w-6 h-6" />
                  {night.players[0].name}
                </p>
              </div>
            )}

            <div className="space-y-2 mb-6">
              {night.players.map((p, i) => {
                const stats = nightAverages(p);
                const rankClass = i === 0 ? "rank-glow-1" : i === 1 ? "rank-glow-2" : i === 2 ? "rank-glow-3" : "shadow-panel";
                return (
                  <div
                    key={p.name}
                    className={`${rankClass} rounded-xl p-4 flex items-center justify-between`}
                    style={i < 3 ? undefined : { background: "var(--color-surface)" }}
                  >
                    <div>
                      <p style={{ color: "var(--color-cream)", fontWeight: 600 }}>{p.name}</p>
                      <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                        {p.wins}-{p.losses} denne kvelden
                      </p>
                    </div>
                    <div className="text-right tabular">
                      <p style={{ color: "var(--color-teal)", fontWeight: 700 }}>
                        {stats.hitPct !== null ? `${Math.round(stats.hitPct)}%` : "–"}
                      </p>
                      <p style={{ color: "var(--color-muted)", fontSize: "0.65rem", letterSpacing: "0.05em" }}>SNITT TREFF</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center mb-8" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
              Kastspredning vises kun rett etter hver kamp på vinnerskjermen — rå kast lagres ikke
              historisk, så denne oppsummeringen viser tall, ikke kart.
            </p>
          </>
        )}

        {otherDates.length > 0 && (
          <>
            <p className="mb-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              ANDRE KVELDER
            </p>
            <div className="flex flex-wrap gap-2">
              {otherDates.map((d) => (
                <Link
                  key={d}
                  href={`/kveld/${d}`}
                  className={`tactile px-3 py-1.5 rounded-full text-sm ${FOCUS_RING}`}
                  style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
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
