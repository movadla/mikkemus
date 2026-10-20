"use client";

import Link from "next/link";
import { useState } from "react";
import { STEP_LABELS } from "@/lib/game";
import { avatarAccent } from "@/lib/avatarAccent";
import { SOURCES, singleView, teamView, type Source, type View } from "@/lib/playerView";
import { ratingOf, type PlayerRecord } from "@/lib/storage";
import { RowDartsChart } from "./RowDartsChart";

const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${Math.round(v)} %`);
const mm = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${Math.round(v)} mm`);
const num = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? "–" : v.toFixed(digits).replace(".", ","));

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-2 py-3 text-center" style={{ background: "var(--color-cell)" }}>
      <p style={{ color: "var(--color-muted)", fontSize: "0.7rem", letterSpacing: "0.05em" }}>{label}</p>
      <p className="tabular" style={{ color: "var(--color-cream)", fontSize: "1.05rem", fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function Dots({ results }: { results: boolean[] }) {
  if (results.length === 0) return null;
  return (
    <span className="inline-flex gap-1" aria-label={results.map((r) => (r ? "seier" : "tap")).join(", ")}>
      {results.map((r, i) => (
        <i key={i} style={{ width: 12, height: 12, borderRadius: 999, background: r ? "var(--color-green)" : "var(--color-red)", display: "block" }} />
      ))}
    </span>
  );
}

function Rows({ view }: { view: View }) {
  if (!view.rows) return null;
  return (
    <>
      <p className="section-label mt-4 mb-2" style={{ fontSize: "0.75rem" }}>TREFF PER RAD</p>
      <div className="grid grid-cols-5 gap-2">
        {view.rows.map((r) => (
          <div key={r.step} className="rounded-md py-2 text-center tabular" style={{ background: "var(--color-cell)" }}>
            <p style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>{STEP_LABELS[r.step]}</p>
            <p style={{ color: "var(--color-cream)", fontSize: "0.8rem", fontWeight: 600 }}>{pct(r.pct)}</p>
          </div>
        ))}
      </div>
    </>
  );
}

/** Darts spent per row over the matches of the chosen source — the winner screen's chart, for a whole career. */
function RowDarts({ view, who, source }: { view: View; who: string; source: Source }) {
  if (!view.rowDarts) return null;
  const n = view.rowDartsMatches;
  return (
    <>
      <p className="section-label mt-4 mb-2" style={{ fontSize: "0.75rem" }}>PILER PER RAD</p>
      <RowDartsChart key={`${who}-${source}`} costs={view.rowDarts} who={who} />
      <p className="mt-1" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
        Over {n} {n === 1 ? "kamp" : "kamper"}
        {view.rowDartsApprox > 0 ? ` — ${view.rowDartsApprox} eldre ${view.rowDartsApprox === 1 ? "kamp er" : "kamper er"} regnet som kryss pluss bom, der en trippel teller tre.` : "."}
      </p>
    </>
  );
}

function Panel({ player, all, source, onSource }: { player: PlayerRecord; all: PlayerRecord[]; source: Source; onSource: (s: Source) => void }) {
  const [tab, setTab] = useState<"single" | "team">("single");
  const single = singleView(player, source);
  const team = teamView(player, all, source);
  const splitNote = source !== "both" ? "Per rad, rekord og rating er ikke delt på kilde, og vises under Begge." : null;

  return (
    <div className="px-4 pb-4 pt-1">
      <div className="grid grid-cols-2 gap-2 mb-3" role="tablist">
        {(["single", "team"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`tactile rounded-lg ${FOCUS_RING}`}
            style={{ minHeight: "2.75rem", background: tab === t ? "var(--color-teal)" : "var(--color-cell)", color: tab === t ? "var(--color-bg)" : "var(--color-cream)", border: "1px solid var(--color-border)", fontWeight: 600, fontSize: "0.9rem" }}
          >
            {t === "single" ? "Singel" : "Lag"}
          </button>
        ))}
      </div>

      <div className="flex rounded-full p-1 mb-4" role="group" aria-label="Hvor kastene er registrert" style={{ background: "var(--color-cell)", border: "1px solid var(--color-border)" }}>
        {SOURCES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={source === s.value}
            onClick={() => onSource(s.value)}
            className={`flex-1 rounded-full ${FOCUS_RING}`}
            style={{ minHeight: "2.5rem", background: source === s.value ? "var(--color-gold)" : "transparent", color: source === s.value ? "var(--color-bg)" : "var(--color-cream)", fontWeight: 600, fontSize: "0.85rem" }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {tab === "single" ? (
        single.matches === 0 && source === "both" ? (
          <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>Ingen singelkamper ennå.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="KAMPER" value={String(single.matches)} />
              <Tile label="SEIRE" value={String(single.wins)} />
              <Tile label="SEIER %" value={pct(single.winPct)} />
              <Tile label="TREFF %" value={pct(single.hitPct)} />
              <Tile label="MED" value={mm(single.med)} />
              <Tile label="PILER/SEIER" value={num(single.dartsPerWin)} />
              <Tile label="MHD" value={mm(single.mhd)} />
              <Tile label="MVD" value={mm(single.mvd)} />
              <Tile label="REKKE" value={source === "both" ? num(single.bestRun) : "–"} />
              {source === "both" && <Tile label="RATING" value={ratingOf(player).toLocaleString("nb-NO").replace(/\s/g, " ")} />}
            </div>
            <div className="flex items-center gap-3 mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
              <span>Siste ti</span>
              <Dots results={single.results} />
              {single.results.length === 0 && <span>–</span>}
            </div>
            <Rows view={single} />
            <RowDarts view={single} who={player.name} source={source} />
            {single.unsorted > 0 && <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{single.unsorted} eldre {single.unsorted === 1 ? "kamp" : "kamper"} mangler kilde og er ikke med.</p>}
          </>
        )
      ) : team.teams.length === 0 ? (
        <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>{player.name} har ikke spilt på lag ennå.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="KAMPER" value={String(team.matches)} />
            <Tile label="SEIRE" value={String(team.wins)} />
            <Tile label="SEIER %" value={pct(team.winPct)} />
            <Tile label="LAGETS TREFF" value={pct(team.hitPct)} />
            <Tile label="DITT TREFF" value={pct(team.ownHitPct)} />
            <Tile label="DINE PILER" value={source === "both" ? String(team.ownDarts) : "–"} />
            <Tile label="MED" value={mm(team.med)} />
            <Tile label="REKKE" value={source === "both" ? num(team.bestRun) : "–"} />
          </div>
          <div className="flex items-center gap-3 mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
            <span>Siste ti</span>
            <Dots results={team.results} />
            {team.results.length === 0 && <span>–</span>}
          </div>
          <p className="section-label mt-4 mb-2" style={{ fontSize: "0.75rem" }}>LAGENE</p>
          <div className="space-y-2">
            {team.teams.map((t) => (
              <div key={t.name} className="rounded-lg px-3 py-2 flex items-center justify-between gap-3" style={{ background: "var(--color-cell)" }}>
                <span className="min-w-0">
                  <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{t.name}</span>
                  <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>med {t.partners.join(", ") || "–"}</span>
                </span>
                <span className="tabular shrink-0" style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>{t.wins}–{t.matches - t.wins}</span>
              </div>
            ))}
          </div>
          <Rows view={team} />
          <RowDarts view={team} who={player.name} source={source} />
          <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
            Dine egne tall i lagkamper samles inn fra og med 2026-10-17{team.ownMatches === 0 ? ", så de fylles ut etter hvert som dere spiller." : "."}
            {source === "manual" ? " Lagets treff er fra kampene uten målte kast." : ""}
          </p>
          {splitNote && <p className="mt-1" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{splitNote}</p>}
        </>
      )}
      {tab === "single" && splitNote && <p className="mt-1" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{splitNote}</p>}

      <Link href={`/spillere/${encodeURIComponent(player.name)}`} className={`block mt-4 text-center rounded-lg ${FOCUS_RING}`} style={{ color: "var(--color-teal-strong)", fontSize: "0.85rem", minHeight: "2.75rem", lineHeight: "2.75rem" }}>
        Åpne spillersiden ›
      </Link>
    </div>
  );
}

/**
 * Every player as a line with a name. Open one and there are two tabs: how they do alone (Singel) and in a team
 * (Lag), with one switch for whether the numbers are from matches entered by hand, measured by Scolia, or both.
 */
export function PlayerStatsAccordion({ players, all }: { players: PlayerRecord[]; all: PlayerRecord[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("both");
  return (
    <div className="space-y-2">
      {players.map((p) => {
        const isOpen = open === p.name;
        const s = singleView(p, "both");
        const t = teamView(p, all, "both");
        return (
          <div key={p.name} className="shadow-panel rounded-xl overflow-hidden" style={{ background: "var(--color-surface)" }}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : p.name)}
              className={`w-full flex items-center gap-4 px-4 text-left ${FOCUS_RING}`}
              style={{ minHeight: "3.75rem" }}
            >
              <span className="rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ width: "2.5rem", height: "2.5rem", background: "var(--color-cell)", border: "1px solid var(--color-border)" }}>
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span style={{ color: avatarAccent(p.name) }}>{p.name.charAt(0).toUpperCase()}</span>
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{p.name}</span>
                <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                  Singel {s.matches} · Lag {t.matches}
                </span>
              </span>
              <span aria-hidden style={{ color: "var(--color-muted)", fontSize: "1.2rem", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>›</span>
            </button>
            {isOpen && <Panel player={p} all={all} source={source} onSource={setSource} />}
          </div>
        );
      })}
    </div>
  );
}
