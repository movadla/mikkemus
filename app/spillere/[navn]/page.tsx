"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { STEPS, STEP_LABELS } from "@/lib/game";
import {
  averageDartsPerWin,
  averagePct,
  favoriteNumber,
  favoriteRingNumber,
  meanEuclideanDistance,
  meanHorizontalDistance,
  meanVerticalDistance,
  useRoster,
} from "@/lib/storage";
import { avatarAccent } from "@/lib/avatarAccent";
import { StatsLineChart, CHART_SERIES_COLORS } from "@/components/StatsLineChart";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: "var(--color-cell)" }}>
      <p style={{ color: "var(--color-muted)", fontSize: "0.65rem", letterSpacing: "0.05em" }}>{label}</p>
      <p className="tabular" style={{ color: "var(--color-cream)", fontSize: "1.05rem", fontWeight: 700 }}>
        {value}
      </p>
    </div>
  );
}

export default function PlayerDetailPage() {
  const params = useParams<{ navn: string }>();
  const name = decodeURIComponent(params.navn ?? "");
  const roster = useRoster();
  const player = roster.find((p) => p.name.toLowerCase() === name.toLowerCase());

  if (!player) {
    return (
      <div className="animate-screen-enter min-h-screen w-full p-4" style={{ background: "var(--color-bg)" }}>
        <div className="max-w-md mx-auto pt-10 text-center">
          <p style={{ color: "var(--color-muted)" }}>Fant ikke spilleren «{name}».</p>
          <Link href="/spillere" className={`inline-block mt-4 tactile px-4 py-2 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}>
            ← Tilbake
          </Link>
        </div>
      </div>
    );
  }

  const favNumber = favoriteNumber(player);
  const favTriple = favoriteRingNumber(player.tripleHits);
  const favDouble = favoriteRingNumber(player.doubleHits);
  const med = meanEuclideanDistance(player);
  const mhd = meanHorizontalDistance(player);
  const mvd = meanVerticalDistance(player);

  const history = player.matchHistory;

  return (
    <div className="animate-screen-enter min-h-screen w-full p-4" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 pt-2">
          <Link href="/spillere" className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}>
            ← Tilbake
          </Link>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.4rem" }}>
            {player.name}
          </h1>
          <div style={{ width: "72px" }} />
        </div>

        <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-14 h-14 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
              style={{ background: "var(--color-cell)", border: "1px solid var(--color-border)" }}
            >
              {player.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display" style={{ color: avatarAccent(player.name), fontSize: "1.3rem" }}>
                  {player.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p style={{ color: "var(--color-cream)", fontWeight: 600 }}>
                {player.matchesPlayed} {player.matchesPlayed === 1 ? "kamp" : "kamper"} · {player.matchesWon} seire
              </p>
            </div>
            <div className="text-right tabular">
              <p style={{ color: "var(--color-teal)", fontSize: "1.4rem", fontWeight: 700 }}>{averagePct(player.overall)}%</p>
              <p style={{ color: "var(--color-muted)", fontSize: "0.65rem", letterSpacing: "0.1em" }}>TOTALT</p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {STEPS.map((s) => (
              <div
                key={s}
                className="rounded-md py-1.5 text-center tabular"
                style={{ background: "var(--color-cell)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -4px 8px rgba(0,0,0,0.18)" }}
              >
                <p style={{ color: "var(--color-muted)", fontSize: "0.6rem" }}>{STEP_LABELS[s]}</p>
                <p style={{ color: "var(--color-cream)", fontSize: "0.75rem", fontWeight: 600 }}>{averagePct(player.steps[s])}%</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard label="SNITT PILER PR RUNDE" value={String(averageDartsPerWin(player) ?? "–")} />
          <StatCard label="BESTE RUNDE (PILER)" value={String(player.bestDartsToFinish ?? "–")} />
          <StatCard label="FAVORITTALL" value={favNumber ? STEP_LABELS[favNumber] : "–"} />
          <StatCard label="FAVORITT-TRIPPEL" value={favTriple !== null ? `T${favTriple}` : "–"} />
          <StatCard label="FAVORITT-DOBBEL" value={favDouble !== null ? `D${favDouble}` : "–"} />
          <StatCard label="MED / MHD / MVD" value={med === null ? "–" : `${Math.round(med)} / ${Math.round(mhd!)} / ${Math.round(mvd!)}mm`} />
        </div>

        <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
          <p className="mb-3" style={{ color: "var(--color-gold)", fontSize: "0.85rem", letterSpacing: "0.1em" }}>
            TREFFPROSENT OVER TID
          </p>
          <StatsLineChart series={[{ label: "Treffprosent", color: "var(--color-teal)", points: history.map((h) => h.hitPct) }]} unit="%" />
        </div>

        <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
          <p className="mb-3" style={{ color: "var(--color-gold)", fontSize: "0.85rem", letterSpacing: "0.1em" }}>
            PRESISJON OVER TID (MM)
          </p>
          <StatsLineChart
            series={[
              { label: "MED", color: CHART_SERIES_COLORS[0], points: history.map((h) => h.med) },
              { label: "MHD", color: CHART_SERIES_COLORS[1], points: history.map((h) => h.mhd) },
              { label: "MVD", color: CHART_SERIES_COLORS[2], points: history.map((h) => h.mvd) },
            ]}
            unit="mm"
          />
        </div>
      </div>
    </div>
  );
}
