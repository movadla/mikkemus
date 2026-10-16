"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { STEPS, STEP_LABELS } from "@/lib/game";
import {
  averageDartsPerWin,
  averagePct,
  bullDuelHitPct,
  bullDuelLuckSum,
  deletePlayer,
  renameTeam,
  favoriteNumber,
  favoriteRingNumber,
  luckSum,
  luckSumForStep,
  meanEuclideanDistance,
  meanHorizontalDistance,
  meanVerticalDistance,
  useRoster,
} from "@/lib/storage";
import { StatsLineChart, CHART_SERIES_COLORS } from "@/components/StatsLineChart";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PhotoButton } from "@/components/PhotoButton";
import { TEAM_NAME_MAX } from "@/lib/teamNames";
import { ScreenTop } from "@/components/ScreenTop";
import { SoundClipButton } from "@/components/SoundClipButton";
import { TrashIcon } from "@/components/icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="cell-tile rounded-lg p-4 text-center flex flex-col justify-center" style={{ minHeight: "4.5rem" }}>
      <p style={{ color: "var(--color-muted)", fontSize: "0.75rem", letterSpacing: "0.05em" }}>{label}</p>
      <p className="tabular" style={{ color: "var(--color-cream)", fontSize: "1.05rem", fontWeight: 700 }}>
        {value}
      </p>
    </div>
  );
}

/** One player, or one team: the numbers, the clip that plays on their turn, and the one place
 *  they can be deleted — away from the list, where a bin beside every name was easy to hit. */
export default function PlayerDetailPage() {
  const params = useParams<{ navn: string }>();
  const router = useRouter();
  const name = decodeURIComponent(params.navn ?? "");
  const roster = useRoster();
  const player = roster.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newName, setNewName] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");

  if (!player) {
    return (
      <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
        <div className="screen-inner">
          <ScreenTop title="Spiller" backHref="/spillere" backLabel="← Tilbake" />
          <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
            Fant ikke «{name}»
          </p>
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
  const luck = luckSum(player);
  const bullDuelPct = bullDuelHitPct(player);
  const bullDuelLuck = bullDuelLuckSum(player);
  const history = player.matchHistory;
  const teams = player.kind === "team" ? [] : roster.filter((r) => r.kind === "team" && (r.members ?? []).some((m) => m.toLowerCase() === player.name.toLowerCase()));
  const tile = "cell-tile rounded-md py-2 text-center tabular";

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop
          title={player.name}
          backHref="/spillere"
          backLabel="← Tilbake"
          right={
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Slett ${player.name}`}
              className={`tactile rounded-lg flex items-center justify-center ${FOCUS_RING}`}
              style={{ width: "2.75rem", height: "2.75rem", background: "var(--color-surface)", color: "var(--color-red)", border: "1px solid var(--color-border)" }}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          }
        />

        {confirmingDelete && (
          <ConfirmDialog
            message={`Slette ${player.name}? Statistikken slettes også, og det kan ikke angres.`}
            buttons={[
              { label: "Nei, behold", onClick: () => setConfirmingDelete(false), background: "var(--color-green)" },
              {
                label: "Ja, slett",
                onClick: () => {
                  deletePlayer(player.name);
                  router.push("/spillere");
                },
                background: "var(--color-red)",
              },
            ]}
          />
        )}

        <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
          <div className="flex items-center gap-4 mb-4">
            <PhotoButton name={player.name} photo={player.photo} />
            <div className="flex-1 min-w-0">
              {player.kind === "team" && (
                <p className="truncate" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                  Lag ·{" "}
                  {(player.members ?? []).map((m, i) => (
                    <span key={m}>
                      {i > 0 && ", "}
                      <Link href={`/spillere/${encodeURIComponent(m)}`} className={`underline ${FOCUS_RING}`} style={{ color: "var(--color-cream)" }}>
                        {m}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
              <p style={{ color: "var(--color-cream)", fontWeight: 600 }}>
                {player.matchesPlayed} {player.matchesPlayed === 1 ? "kamp" : "kamper"} · {player.matchesWon} seire
              </p>
            </div>
            <div className="text-right tabular">
              <p style={{ color: "var(--color-teal)", fontSize: "1.4rem", fontWeight: 700 }}>{averagePct(player.overall)}%</p>
              <p className="section-label" style={{ fontSize: "0.75rem" }}>TOTALT</p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {STEPS.map((s) => (
              <div key={s} className={tile}>
                <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{STEP_LABELS[s]}</p>
                <p style={{ color: "var(--color-cream)", fontSize: "0.75rem", fontWeight: 600 }}>{averagePct(player.steps[s])}%</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatCard label="SNITT PILER/RUNDE" value={String(averageDartsPerWin(player) ?? "–")} />
          <StatCard label="BESTE RUNDE (PILER)" value={String(player.bestDartsToFinish ?? "–")} />
          <StatCard label="LENGSTE SERIE (PILER)" value={player.bestRun ? `${player.bestRun} på rad` : "–"} />
          <StatCard label="FAVORITTALL" value={favNumber ? STEP_LABELS[favNumber] : "–"} />
          <StatCard label="FAVORITT-TRIPPEL" value={favTriple !== null ? `T${favTriple}` : "–"} />
          <StatCard label="FAVORITT-DOBBEL" value={favDouble !== null ? `D${favDouble}` : "–"} />
          <StatCard label="MED / MHD / MVD" value={med === null ? "–" : `${Math.round(med)} / ${Math.round(mhd!)} / ${Math.round(mvd!)}mm`} />
          <StatCard label="FORVENTEDE TREFF" value={luck === null ? "–" : `${luck.toFixed(1)} / ${player.overall.hits}`} />
          <StatCard label="BULL: KAST/POENG/%" value={player.bullDuel.throws === 0 ? "–" : `${player.bullDuel.throws} / ${player.bullDuel.points} / ${bullDuelPct}%`} />
          <StatCard label="BULL: FORVENTET" value={bullDuelLuck === null ? "–" : `${bullDuelLuck.toFixed(1)} / ${player.bullDuel.points}`} />
        </div>

        <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">FORVENTEDE TREFF PER RAD</p>
          <div className="grid grid-cols-5 gap-2">
            {STEPS.map((s) => {
              const stepLuck = luckSumForStep(player, s);
              return (
                <div key={s} className={tile}>
                  <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{STEP_LABELS[s]}</p>
                  <p style={{ color: "var(--color-cream)", fontSize: "0.75rem", fontWeight: 600 }}>
                    {stepLuck === null ? "–" : `${stepLuck.toFixed(1)}/${player.steps[s].hits}`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">TREFFPROSENT OVER TID</p>
          <StatsLineChart series={[{ label: "Treffprosent", color: "var(--color-teal)", points: history.map((h) => h.hitPct) }]} unit="%" />
        </div>

        <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
          <p className="mb-4 section-label">PRESISJON OVER TID (MM)</p>
          <StatsLineChart
            series={[
              { label: "MED", color: CHART_SERIES_COLORS[0], points: history.map((h) => h.med) },
              { label: "MHD", color: CHART_SERIES_COLORS[1], points: history.map((h) => h.mhd) },
              { label: "MVD", color: CHART_SERIES_COLORS[2], points: history.map((h) => h.mvd) },
            ]}
            unit="mm"
          />
        </div>

        {/* A team can be called anything — it does not have to be its players' names. */}
        {player.kind === "team" && (
          <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
            <label htmlFor="rename-team" className="mb-2 section-label block">
              LAGNAVN
            </label>
            <div className="flex gap-2">
              <input
                id="rename-team"
                value={newName ?? player.name}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNameError("");
                }}
                maxLength={TEAM_NAME_MAX}
                className={`flex-1 min-w-0 px-4 rounded-lg ${FOCUS_RING}`}
                style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
              />
              <button
                type="button"
                disabled={newName === null || newName.trim() === player.name}
                onClick={() => {
                  const result = renameTeam(player.name, newName ?? "");
                  if (!result.ok) {
                    setNameError(result.error);
                    return;
                  }
                  setNewName(null);
                  router.replace(`/spillere/${encodeURIComponent(result.name)}`);
                }}
                className={`glossy px-4 rounded-lg font-medium ${FOCUS_RING}`}
                style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "2.75rem" } as React.CSSProperties}
              >
                Lagre
              </button>
            </div>
            {nameError && (
              <p role="alert" className="mt-2" style={{ color: "var(--color-red)", fontSize: "0.75rem" }}>
                {nameError}
              </p>
            )}
          </div>
        )}

        {/* The teams this player is in — their matches are on the team's page, not here. */}
        {teams.length > 0 && (
          <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">LAG</p>
            <div className="space-y-2">
              {teams.map((t) => (
                <Link
                  key={t.name}
                  href={`/spillere/${encodeURIComponent(t.name)}`}
                  className={`tactile flex items-center justify-between gap-2 px-4 rounded-lg ${FOCUS_RING}`}
                  style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="tabular shrink-0" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
                    {t.matchesWon} av {t.matchesPlayed} {t.matchesPlayed === 1 ? "kamp" : "kamper"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* A clip plays when it becomes someone's turn; in a team that is a member's turn, so a team has none. */}
        {player.kind !== "team" && (
          <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">LYDKLIPP</p>
            <SoundClipButton name={player.name} />
          </div>
        )}

        <Link href="/" className={`tactile block text-center rounded-lg ${FOCUS_RING}`} style={{ lineHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
          Hjem
        </Link>
      </div>
    </div>
  );
}
