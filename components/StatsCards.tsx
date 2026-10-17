"use client";

import Link from "next/link";
import { STEPS, STEP_LABELS } from "@/lib/game";
import { averageDartsPerWin, averagePct, ratingOf, meanEuclideanDistance, meanHorizontalDistance, meanVerticalDistance, useRoster, type PlayerRecord } from "@/lib/storage";
import { memberHitPct, memberMed } from "@/lib/memberStats";
import { avatarAccent } from "@/lib/avatarAccent";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** One player or team with their numbers — a team has its members under the name. */
function RecordCard({ p }: { p: PlayerRecord }) {
  return (
    <Link
      href={`/spillere/${encodeURIComponent(p.name)}`}
      className={`block shadow-panel rounded-xl p-4 ${FOCUS_RING}`}
      style={{ background: "var(--color-surface)" }}
    >
      <div className="flex items-center gap-4 mb-4">
        <div
          className="rounded-full overflow-hidden shrink-0 flex items-center justify-center"
          style={{ width: "2.75rem", height: "2.75rem", background: "var(--color-cell)", border: "1px solid var(--color-border)" }}
        >
          {p.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <span style={{ color: avatarAccent(p.name) }}>{p.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{p.name}</p>
          <p className="truncate" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
            {p.kind === "team" && p.members?.length ? `${p.members.join(", ")} · ` : ""}
            {p.matchesPlayed} {p.matchesPlayed === 1 ? "kamp" : "kamper"}
            {p.rating !== undefined && ` · rating ${ratingOf(p).toLocaleString("nb-NO").replace(/\s/g, "\u202f")}`}
          </p>
        </div>
        <div className="text-right tabular shrink-0">
          <p style={{ color: "var(--color-teal)", fontSize: "1.3rem", fontWeight: 700 }}>
            {averagePct(p.overall)}%
          </p>
          <p className="section-label" style={{ fontSize: "0.75rem" }}>TOTALT</p>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {STEPS.map((s) => (
          <div
            key={s}
            className="rounded-md py-2 text-center tabular"
            style={{ background: "var(--color-cell)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -4px 8px rgba(0,0,0,0.18)" }}
          >
            <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{STEP_LABELS[s]}</p>
            <p style={{ color: "var(--color-cream)", fontSize: "0.75rem", fontWeight: 600 }}>
              {averagePct(p.steps[s])}%
            </p>
          </div>
        ))}
      </div>
      {p.kind === "team" && p.memberStats && Object.keys(p.memberStats).length > 0 && (
        <div className="mb-4 rounded-lg px-3 py-2" style={{ background: "var(--color-cell)" }}>
          <div className="grid items-baseline gap-x-2" style={{ gridTemplateColumns: "minmax(0,1fr) 3.5rem 3.5rem 3.5rem" }}>
            <span className="section-label" style={{ fontSize: "0.75rem" }}>SPILLER</span>
            <span className="section-label text-right" style={{ fontSize: "0.75rem" }}>TREFF</span>
            <span className="section-label text-right" style={{ fontSize: "0.75rem" }}>MED</span>
            <span className="section-label text-right" style={{ fontSize: "0.75rem" }}>PILER</span>
            {(p.members ?? Object.keys(p.memberStats)).filter((m) => p.memberStats![m]).map((m) => {
              const s = p.memberStats![m];
              const pct = memberHitPct(s);
              const med = memberMed(s);
              return (
                <div key={m} className="contents">
                  <span className="truncate py-1" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{m}</span>
                  <span className="tabular text-right" style={{ color: "var(--color-teal)", fontWeight: 700 }}>{pct === null ? "–" : `${pct}%`}</span>
                  <span className="tabular text-right" style={{ color: "var(--color-cream)", fontSize: "0.85rem" }}>{med === null ? "–" : `${Math.round(med)}mm`}</span>
                  <span className="tabular text-right" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>{s.darts}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--color-border)" }}>
        <span className="section-label" style={{ fontSize: "0.75rem" }}>SNITT PILER PR RUNDE</span>
        <span className="tabular" style={{ color: "var(--color-teal)", fontWeight: 700 }}>
          {averageDartsPerWin(p) ?? "–"}
        </span>
      </div>
      <div className="mt-2 pt-2 grid grid-cols-3 gap-2 text-center" style={{ borderTop: "1px solid var(--color-border)" }}>
        {[
          { label: "MED", value: meanEuclideanDistance(p) },
          { label: "MHD", value: meanHorizontalDistance(p) },
          { label: "MVD", value: meanVerticalDistance(p) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p style={{ color: "var(--color-muted)", fontSize: "0.75rem", letterSpacing: "0.05em" }}>{label}</p>
            <p className="tabular" style={{ color: "var(--color-cream)", fontSize: "0.8rem", fontWeight: 600 }}>
              {value === null ? "–" : `${Math.round(value)}mm`}
            </p>
          </div>
        ))}
      </div>
    </Link>
  );
}

/** Every player with their numbers, then every team with a record of its own. A card opens the player's or the
 *  team's own page, where the name, the picture, the sound and the rest are changed. */
export function PlayerStatCards() {
  const roster = useRoster();
  const players = roster.filter((p) => p.kind !== "team");
  const teams = roster.filter((p) => p.kind === "team");

  return (
    <>
      {roster.length === 0 && (
        <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
          Ingen spillere ennå
        </p>
      )}

      {teams.length > 0 && players.length > 0 && <p className="section-label mb-2">SPILLERE</p>}
      <div className="space-y-4">
        {players.map((p) => (
          <RecordCard key={p.name} p={p} />
        ))}
      </div>

      {teams.length > 0 && (
        <>
          <p className="section-label mb-2 mt-8">LAG</p>
          <div className="space-y-4">
            {teams.map((p) => (
              <RecordCard key={p.name} p={p} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
