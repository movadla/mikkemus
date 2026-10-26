"use client";

import Link from "next/link";
import { useState } from "react";
import { STEP_LABELS } from "@/lib/game";
import { avatarAccent } from "@/lib/avatarAccent";
import { SOURCES, singleView, teamView, type Source, type View } from "@/lib/playerView";
import { ratingOf, type PlayerRecord } from "@/lib/storage";
import { coachTips, sumBias } from "@/lib/coach";
import { memberHitPct, memberMed } from "@/lib/memberStats";
import { RowDartsChart, type RowChartUnit } from "./RowDartsChart";
import { Segmented } from "./ui/Segmented";
import { Sheet } from "./ui/Sheet";
import { STEPS, type Step } from "@/lib/game";

const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${Math.round(v)} %`);
const mm = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${Math.round(v)} mm`);
const num = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? "–" : v.toFixed(digits).replace(".", ","));

/** A group of figures under a small heading. The distances carry a "?" that explains them in two sentences. */
function TileGroup({ label, help = false, children }: { label: string; help?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="section-label">{label}</p>
        {help && (
          <button type="button" onClick={() => setOpen(true)} aria-label="Hva betyr tallene?" className={`tactile flex items-center justify-center ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-s)", color: "var(--color-muted)", boxShadow: "none", background: "transparent", fontSize: "var(--text-body)", fontWeight: 700 }}>
            ?
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">{children}</div>
      {open && (
        <Sheet title="Avstand fra midten" onClose={() => setOpen(false)}>
          <div className="space-y-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            <p>Snitt er hvor langt fra midten av brettet pilene lander, i millimeter. Lavere er bedre.</p>
            <p>Sideavvik og høydeavvik viser hvilken vei du bommer: til siden, og opp eller ned. Er tallet nær null, bommer du like mye begge veier.</p>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-2 py-3 text-center" style={{ background: "var(--color-surface-2)", boxShadow: "inset 0 0 0 1px var(--veil), inset 0 1px 0 var(--veil), 0 1px 2px color-mix(in srgb, var(--shade) 40%, transparent)" }}>
      <p style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", fontWeight: 600, letterSpacing: "0.14em" }}>{label}</p>
      <p className="tabular" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)", lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.01em" }}>{value}</p>
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

const RING_ROWS: Step[] = ["D", "T"];

/** D and T count a hit whenever one lands, also a slenger thrown at a number, but a miss only while the row is the one being worked. */
function RingNote() {
  return (
    <p className="mt-1" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
      * D og T teller også treff slengt på siden, men bom bare når raden er aktiv. Prosenten er for høy og kan ikke sammenlignes med tallradene.
    </p>
  );
}

function Rows({ view }: { view: View }) {
  if (!view.rows) return null;
  return (
    <>
      <p className="section-label mt-4 mb-2" style={{ fontSize: "var(--text-micro)" }}>TREFF PER RAD</p>
      <div className="grid grid-cols-5 gap-2">
        {view.rows.map((r) => (
          <div key={r.step} className="rounded-xl py-2 text-center tabular" style={{ background: "var(--color-surface-2)", boxShadow: "inset 0 0 0 1px var(--veil), inset 0 1px 0 var(--veil), 0 1px 2px color-mix(in srgb, var(--shade) 40%, transparent)" }}>
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{STEP_LABELS[r.step]}</p>
            <p style={{ color: "var(--color-cream)", fontSize: "var(--text-small)", fontWeight: 600 }}>{pct(r.pct)}{RING_ROWS.includes(r.step) && r.pct !== null ? "*" : ""}</p>
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{r.hits + r.misses === 0 ? "ingen kast" : `${r.hits} av ${r.hits + r.misses}`}</p>
          </div>
        ))}
      </div>
      <RingNote />
    </>
  );
}

/**
 * Per row over the matches of the chosen source — the winner screen's chart, for a whole career — in darts spent or in hit
 * percentage. The two say different things: D and T take few darts because slengere fill them before they are reached, and
 * can still be the rows hit least often when actually aimed at.
 */
function RowDarts({ view, who, source }: { view: View; who: string; source: Source }) {
  const [unit, setUnit] = useState<RowChartUnit>("darts");
  if (!view.rowDarts && !view.rows) return null;
  const pctValues = view.rows ? (Object.fromEntries(view.rows.map((r) => [r.step, r.pct])) as Record<Step, number | null>) : null;
  const dartValues = view.rowDarts;
  const shownUnit: RowChartUnit = unit === "pct" && pctValues ? "pct" : dartValues ? "darts" : "pct";
  const values = shownUnit === "pct" ? pctValues! : dartValues!;
  const n = view.rowDartsMatches;
  return (
    <>
      <div className="flex items-center justify-between mt-4 mb-2 gap-2">
        <p className="section-label" style={{ fontSize: "var(--text-micro)" }}>{shownUnit === "pct" ? "TREFF PER RAD" : "PILER PER RAD"}</p>
        <div className="flex rounded-full p-0.5" role="group" aria-label="Piler eller treffprosent" style={{ background: "var(--color-cell)", border: "1px solid var(--color-border)" }}>
          {(["darts", "pct"] as const).map((u) => {
            const missing = u === "pct" ? !pctValues : !dartValues;
            return (
              <button
                key={u}
                type="button"
                aria-pressed={shownUnit === u}
                disabled={missing}
                onClick={() => setUnit(u)}
                className={`rounded-full px-3 ${FOCUS_RING}`}
                style={{ minHeight: "var(--control)", background: shownUnit === u ? "var(--color-teal)" : "transparent", color: shownUnit === u ? "var(--color-bg)" : "var(--color-cream)", fontWeight: 600, fontSize: "var(--text-micro)", opacity: missing ? 0.4 : 1 }}
              >
                {u === "darts" ? "Piler" : "Treff %"}
              </button>
            );
          })}
        </div>
      </div>
      <RowDartsChart key={`${who}-${source}-${shownUnit}`} values={values} unit={shownUnit} who={who} />
      {shownUnit === "darts" && (
        <p className="mt-1" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
          Over {n} {n === 1 ? "kamp" : "kamper"}
          {view.rowDartsApprox > 0 ? ` — ${view.rowDartsApprox} eldre ${view.rowDartsApprox === 1 ? "kamp er" : "kamper er"} regnet som kryss pluss bom, der en trippel teller tre.` : "."}
        </p>
      )}
      {shownUnit === "pct" && STEPS.some((s) => values[s] === null) && (
        <p className="mt-1" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>En rad uten tall er ikke kastet på i disse kampene.</p>
      )}
    </>
  );
}

/**
 * What a darts trainer would say to someone who has thrown on Scolia: which way the darts miss, what is strong and what to work
 * on. Only for those with measured darts, and only what the numbers support (lib/coach.ts).
 */
function CoachBox({ player, all }: { player: PlayerRecord; all: PlayerRecord[] }) {
  const { tips, darts } = coachTips(player, all);
  if (darts === 0 || (tips.length === 0 && player.accuracy.throws < 30)) return null;
  const bias = sumBias(player);
  const hasDirection = !!bias && bias.n >= 30;
  return (
    <div className="mt-4 rounded-xl p-3" style={{ background: "var(--color-surface-2)", boxShadow: "inset 0 0 0 1px var(--veil), inset 0 1px 0 var(--veil)" }}>
      <p className="section-label mb-2" style={{ fontSize: "var(--text-micro)" }}>TRENEREN SIER</p>
      {tips.length === 0 ? (
        <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Ingen råd ennå: tallene sier ikke noe tydelig, og det er et godt tegn.</p>
      ) : (
        <ul className="space-y-2.5">
          {tips.map((t) => (
            <li key={t.title} className="flex gap-2.5">
              <span
                aria-hidden
                className="shrink-0 rounded-full"
                style={{ width: 8, height: 8, marginTop: "0.4rem", background: t.tone === "good" ? "var(--color-green)" : "var(--color-gold)", boxShadow: `0 0 8px ${t.tone === "good" ? "color-mix(in srgb, var(--color-green) 60%, transparent)" : "color-mix(in srgb, var(--color-gold) 60%, transparent)"}` }}
              />
              <span>
                <span className="block" style={{ color: "var(--color-cream)", fontWeight: 600, fontSize: "var(--text-body)" }}>{t.title}</span>
                <span className="block" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)", lineHeight: 1.45 }}>{t.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2.5" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
        Bygget på {darts} kast målt av Scolia.{hasDirection ? "" : " Retning (for høyt, lavt, venstre eller høyre) kommer etter noen kamper med Scolia fra nå."}
      </p>
    </div>
  );
}

/** What each member of a team has thrown in its matches: hit rate, mean distance and darts. */
function MemberTable({ team }: { team: PlayerRecord }) {
  const stats = team.memberStats;
  const members = (team.members ?? Object.keys(stats ?? {})).filter((m) => stats?.[m]);
  if (!stats || members.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl px-3 py-2" style={{ background: "var(--color-surface-2)" }}>
      <div className="grid items-baseline gap-x-2" style={{ gridTemplateColumns: "minmax(0,1fr) 3.5rem 3.5rem 3.5rem" }}>
        <span className="section-label" style={{ fontSize: "var(--text-micro)" }}>SPILLER</span>
        <span className="section-label text-right" style={{ fontSize: "var(--text-micro)" }}>TREFF</span>
        <span className="section-label text-right" style={{ fontSize: "var(--text-micro)" }}>MED</span>
        <span className="section-label text-right" style={{ fontSize: "var(--text-micro)" }}>PILER</span>
        {members.map((m) => {
          const pct = memberHitPct(stats[m]);
          const med = memberMed(stats[m]);
          return (
            <div key={m} className="contents">
              <span className="truncate py-1" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{m}</span>
              <span className="tabular text-right" style={{ color: "var(--color-teal)", fontWeight: 700 }}>{pct === null ? "–" : `${pct}%`}</span>
              <span className="tabular text-right" style={{ color: "var(--color-cream)", fontSize: "var(--text-small)" }}>{med === null ? "–" : `${Math.round(med)}mm`}</span>
              <span className="tabular text-right" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{stats[m].darts}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ player, all, source, onSource }: { player: PlayerRecord; all: PlayerRecord[]; source: Source; onSource: (s: Source) => void }) {
  const [pickedTab, setTab] = useState<"single" | "team">("single");
  // A team record is one thing, not a person who plays alone and in teams: it has the single view and nothing else.
  const isTeamRecord = player.kind === "team";
  const tab = isTeamRecord ? "single" : pickedTab;
  const single = singleView(player, source);
  const team = teamView(player, all, source);
  const splitNote = source !== "both" ? "Rekord og rating er ikke delt på kilde, og vises under Begge." : null;

  return (
    <div className="px-4 pb-4 pt-1">
      {!isTeamRecord && (
        <div className="mb-3">
          <Segmented value={tab} onChange={setTab} label="Alene eller på lag" options={[{ value: "single", label: "Singel" }, { value: "team", label: "Lag" }]} />
        </div>
      )}

      <div className="mb-4">
        <Segmented value={source} onChange={onSource} label="Hvor kastene er registrert" options={SOURCES.map((x) => ({ value: x.value, label: x.label }))} />
      </div>

      {tab === "single" ? (
        single.matches === 0 && source === "both" ? (
          <p style={{ color: "var(--color-muted)", fontSize: "var(--text-body)" }}>{isTeamRecord ? "Ingen kamper ennå." : "Ingen singelkamper ennå."}</p>
        ) : (
          <>
            <TileGroup label="Resultater">
              <Tile label="KAMPER" value={String(single.matches)} />
              <Tile label="SEIRE" value={String(single.wins)} />
              <Tile label="SEIER %" value={pct(single.winPct)} />
            </TileGroup>
            <TileGroup label="Treff">
              <Tile label="TREFF %" value={pct(single.hitPct)} />
              <Tile label="PILER PER SEIER" value={num(single.dartsPerWin)} />
              <Tile label="LENGSTE SERIE" value={source === "both" ? num(single.bestRun) : "–"} />
              {source === "both" && <Tile label="RATING" value={ratingOf(player).toLocaleString("nb-NO").replace(/\s/g, " ")} />}
            </TileGroup>
            <TileGroup label="Avstand fra midten" help>
              <Tile label="SNITT" value={mm(single.med)} />
              <Tile label="SIDEAVVIK" value={mm(single.mhd)} />
              <Tile label="HØYDEAVVIK" value={mm(single.mvd)} />
            </TileGroup>
            <div className="flex items-center gap-3 mt-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
              <span>Siste ti</span>
              <Dots results={single.results} />
              {single.results.length === 0 && <span>–</span>}
            </div>
            <Rows view={single} />
            <RowDarts view={single} who={player.name} source={source} />
            {isTeamRecord ? <MemberTable team={player} /> : <CoachBox player={player} all={all} />}
            {single.unsorted > 0 && <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{single.unsorted} eldre {single.unsorted === 1 ? "kamp" : "kamper"} mangler kilde og er ikke med.</p>}
          </>
        )
      ) : team.teams.length === 0 ? (
        <p style={{ color: "var(--color-muted)", fontSize: "var(--text-body)" }}>{player.name} har ikke spilt på lag ennå.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="KAMPER" value={String(team.matches)} />
            <Tile label="SEIRE" value={String(team.wins)} />
            <Tile label="SEIER %" value={pct(team.winPct)} />
            <Tile label="LAGETS TREFF" value={pct(team.hitPct)} />
            <Tile label="DITT TREFF" value={pct(team.ownHitPct)} />
            <Tile label="DINE PILER" value={source === "both" ? String(team.ownDarts) : "–"} />
            <Tile label="SNITT" value={mm(team.med)} />
            <Tile label="LENGSTE SERIE" value={source === "both" ? num(team.bestRun) : "–"} />
          </div>
          <div className="flex items-center gap-3 mt-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
            <span>Siste ti</span>
            <Dots results={team.results} />
            {team.results.length === 0 && <span>–</span>}
          </div>
          <p className="section-label mt-4 mb-2" style={{ fontSize: "var(--text-micro)" }}>LAGENE</p>
          <div className="space-y-2">
            {team.teams.map((t) => (
              <div key={t.name} className="rounded-xl px-3 py-2 flex items-center justify-between gap-3" style={{ background: "var(--color-surface-2)", boxShadow: "inset 0 0 0 1px var(--veil), inset 0 1px 0 var(--veil), 0 1px 2px color-mix(in srgb, var(--shade) 40%, transparent)" }}>
                <span className="min-w-0">
                  <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{t.name}</span>
                  <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>med {t.partners.join(", ") || "–"}</span>
                </span>
                <span className="tabular shrink-0" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)" }}>{t.wins}–{t.matches - t.wins}</span>
              </div>
            ))}
          </div>
          <Rows view={team} />
          <RowDarts view={team} who={player.name} source={source} />
          <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
            Dine egne tall i lagkamper samles inn fra og med 2026-10-17{team.ownMatches === 0 ? ", så de fylles ut etter hvert som dere spiller." : "."}
            {source === "manual" ? " Lagets treff er fra kampene uten målte kast." : ""}
          </p>
          {splitNote && <p className="mt-1" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{splitNote}</p>}
        </>
      )}
      {tab === "single" && splitNote && <p className="mt-1" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{splitNote}</p>}

      <Link href={`/spillere/${encodeURIComponent(player.name)}`} className={`block mt-4 text-center rounded-lg ${FOCUS_RING}`} style={{ color: "var(--color-teal-strong)", fontSize: "var(--text-small)", minHeight: "var(--control)", lineHeight: "2.75rem" }}>
        {isTeamRecord ? "Åpne lagsiden ›" : "Åpne spillersiden ›"}
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
        const isTeamRecord = p.kind === "team";
        const s = singleView(p, "both");
        const t = isTeamRecord ? null : teamView(p, all, "both");
        return (
          <div key={p.name} className="shadow-panel rounded-xl overflow-hidden" style={{ background: "var(--color-surface)" }}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : p.name)}
              className={`w-full flex items-center gap-4 px-4 text-left ${FOCUS_RING}`}
              style={{ minHeight: "var(--control-lg)" }}
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
                <span className="block truncate" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                  {t ? `Singel ${s.matches} · Lag ${t.matches}` : `${p.members?.length ? `${p.members.join(", ")} · ` : ""}${s.matches} ${s.matches === 1 ? "kamp" : "kamper"}`}
                </span>
              </span>
              <span aria-hidden style={{ color: "var(--color-muted)", fontSize: "var(--text-title)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>›</span>
            </button>
            {isOpen && <Panel player={p} all={all} source={source} onSource={setSource} />}
          </div>
        );
      })}
    </div>
  );
}
