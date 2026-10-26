"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STEPS, STEP_LABELS } from "@/lib/game";
import { buildSeedTable, entrantInputs, type SeedRow } from "@/lib/seedingTable";
import { averageDartsPerWin, averagePct, meanEuclideanDistance, meanHorizontalDistance, meanVerticalDistance, useRoster } from "@/lib/storage";
import type { PlayerRecord } from "@/lib/playerRows";
import { entrantFromSigmas, simulateTournament, type Entrant, type TournamentResult } from "@/lib/tournamentOdds";
import { fairPrice } from "@/lib/bet/ledger";
import { CheckIcon } from "./icons";
import { SEED_ORDER } from "@/lib/odds/seeding";

const RULES = { target: 3, ringChoice: true };
const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const pct = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? "–" : `${v.toFixed(digits).replace(".", ",")} %`);
const mm = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${Math.round(v)} mm`);
const oddsText = (o: number) => (o >= 100 ? "100+" : o.toFixed(2).replace(".", ","));
const nb = (n: number) => Math.round(n).toLocaleString("nb-NO").replace(/\s/g, " ");

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card mb-5" style={{ background: "var(--color-surface)" }}>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="section-label">{title}</h2>
        {hint && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Dots({ results, size = 12 }: { results: boolean[]; size?: number }) {
  const pad = Math.max(0, 10 - results.length);
  return (
    <span className="inline-flex gap-1" aria-label={results.map((r) => (r ? "seier" : "tap")).join(", ")}>
      {Array.from({ length: pad }).map((_, i) => (
        <i key={`p${i}`} style={{ width: size, height: size, borderRadius: 999, border: "1px solid var(--color-border)", display: "block" }} />
      ))}
      {results.map((r, i) => (
        <i key={i} style={{ width: size, height: size, borderRadius: 999, background: r ? "var(--color-green)" : "var(--color-red)", display: "block" }} />
      ))}
    </span>
  );
}

const FORM_COLOR: Record<SeedRow["form"]["label"], string> = { "På gang": "var(--color-green)", Jevn: "var(--color-muted)", Svak: "var(--color-red)", "For få kamper": "var(--color-muted)" };

/** Who is best, who is in form, how they compare, and what a three-match tournament would give. */
export function SeedingTab() {
  const roster = useRoster();
  const people = useMemo(() => roster.filter((r) => r.kind !== "team"), [roster]);
  const table = useMemo(() => buildSeedTable(roster, RULES), [roster]);
  if (people.length === 0) {
    return (
      <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
        Ingen spillere ennå
      </p>
    );
  }
  return (
    <>
      <SeedingCard rows={table} />
      <FormCard rows={table} />
      <KeyFigures players={people.filter((p) => p.matchesPlayed > 0)} ratings={new Map(table.map((r) => [r.name, r.rating]))} />
      <PerRow players={people.filter((p) => p.matchesPlayed > 0)} />
      <TournamentOdds roster={roster} />
    </>
  );
}

function SeedingCard({ rows }: { rows: SeedRow[] }) {
  return (
    <Card title="SEEDING" hint="Styrke: sjanse mot en typisk spiller">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className={`${i === 0 ? "rank-glow-1" : i === 1 ? "rank-glow-2" : i === 2 ? "rank-glow-3" : ""} rounded-xl px-3 py-2`}
            style={i < 3 ? undefined : { background: "var(--color-cell)" }}
          >
            <div className="flex items-center gap-3">
              <span className="font-display w-6 text-center" style={{ color: i === 0 ? "var(--color-gold)" : "var(--color-muted)", fontSize: "var(--text-title)" }}>
                {r.rank}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{r.name}</span>
                <span className="block" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                  Kaster rundt {mm(r.med)} fra midten · rating {nb(r.rating)}
                  {r.seedRank !== null && (
                    <>
                      {" · "}seeding {r.seedRank}
                      {r.move ? <span style={{ color: r.move > 0 ? "var(--color-green)" : "var(--color-red)" }}> {r.move > 0 ? "▲" : "▼"}{Math.abs(r.move)}</span> : null}
                    </>
                  )}
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block tabular font-display" style={{ color: "var(--color-teal)", fontSize: "var(--text-title)" }}>{pct(r.strength * 100)}</span>
                <Dots results={r.form.results} size={8} />
              </span>
            </div>
            <div className="mt-2 rounded-full overflow-hidden" style={{ height: 5, background: "color-mix(in srgb, var(--shade) 30%, transparent)" }}>
              <div style={{ width: `${Math.round(r.strength * 100)}%`, height: "100%", background: i === 0 ? "var(--color-gold)" : "var(--color-teal)" }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
        Rekkefølgen bygger bare på kampene: det de har kastet og hvordan det har gått. Spillere uten kamper ligger nederst til de har spilt.
      </p>
    </Card>
  );
}

function FormCard({ rows }: { rows: SeedRow[] }) {
  const sorted = [...rows].sort((a, b) => (b.form.score ?? -1) - (a.form.score ?? -1));
  return (
    <Card title="I FORM" hint="Siste ti kamper">
      <div className="space-y-2">
        {sorted.map((r) => (
          <div key={r.name} className="rounded-xl px-3 py-2 flex items-center gap-3" style={{ background: "var(--color-cell)" }}>
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{r.name}</span>
              <span className="block" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                {r.form.n === 0 ? "Ingen kamper" : `${r.form.wins}–${r.form.losses}`}
                {r.form.hit5 !== null && ` · treff ${pct(r.form.hit5)}`}
                {r.form.dHit !== null && (
                  <span style={{ color: Math.round(r.form.dHit) === 0 ? "var(--color-muted)" : r.form.dHit > 0 ? "var(--color-green)" : "var(--color-red)" }}>
                    {Math.round(r.form.dHit) === 0 ? " (som vanlig)" : ` (${r.form.dHit > 0 ? "+" : "−"}${Math.abs(Math.round(r.form.dHit))} mot vanlig)`}
                  </span>
                )}
                {r.form.med5 !== null && r.form.medAll !== null && ` · MED ${mm(r.form.med5)}`}
              </span>
            </span>
            <Dots results={r.form.results} size={10} />
            <span className="shrink-0 text-right" style={{ color: FORM_COLOR[r.form.label], fontSize: "var(--text-small)", fontWeight: 600, minWidth: "5.2rem" }}>{r.form.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

type Col = { key: string; label: string; value: (p: PlayerRecord, rating: number) => number | null; show: (v: number | null) => string; lowIsBest?: boolean };
const COLS: Col[] = [
  { key: "matches", label: "Kamper", value: (p) => p.matchesPlayed, show: (v) => (v === null ? "–" : String(v)) },
  { key: "wins", label: "Seire", value: (p) => p.matchesWon, show: (v) => (v === null ? "–" : String(v)) },
  { key: "winPct", label: "Seier %", value: (p) => (p.matchesPlayed ? (p.matchesWon / p.matchesPlayed) * 100 : null), show: (v) => pct(v) },
  { key: "hit", label: "Treff %", value: (p) => averagePct(p.overall), show: (v) => pct(v) },
  { key: "med", label: "MED", value: (p) => meanEuclideanDistance(p), show: (v) => mm(v), lowIsBest: true },
  { key: "mhd", label: "MHD", value: (p) => meanHorizontalDistance(p), show: (v) => mm(v), lowIsBest: true },
  { key: "mvd", label: "MVD", value: (p) => meanVerticalDistance(p), show: (v) => mm(v), lowIsBest: true },
  { key: "darts", label: "Piler/seier", value: (p) => averageDartsPerWin(p), show: (v) => (v === null ? "–" : String(v).replace(".", ",")), lowIsBest: true },
  { key: "run", label: "Rekke", value: (p) => p.bestRun ?? null, show: (v) => (v === null ? "–" : String(v)) },
  { key: "rating", label: "Rating", value: (_p, rating) => rating, show: (v) => (v === null ? "–" : nb(v)) },
];

function KeyFigures({ players, ratings }: { players: PlayerRecord[]; ratings: Map<string, number> }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "rating", dir: -1 });
  const col = COLS.find((c) => c.key === sort.key) ?? COLS[0];
  const rows = [...players].sort((a, b) => {
    const x = col.value(a, ratings.get(a.name) ?? 0);
    const y = col.value(b, ratings.get(b.name) ?? 0);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * sort.dir;
  });
  if (rows.length === 0) return null;
  return (
    <Card title="NØKKELTALL" hint="Trykk på en overskrift for å sortere">
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full tabular" style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: "var(--text-small)", minWidth: "34rem" }}>
          <thead>
            <tr>
              <th className="text-left pb-2 pr-2" style={{ position: "sticky", left: 0, background: "var(--color-surface)" }} />
              {COLS.map((c) => (
                <th key={c.key} className="pb-2 px-2 text-right">
                  <button
                    type="button"
                    onClick={() => setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: c.lowIsBest ? 1 : -1 }))}
                    className={`${FOCUS_RING} rounded`}
                    style={{ color: sort.key === c.key ? "var(--color-gold-strong)" : "var(--color-muted)", fontSize: "var(--text-micro)", letterSpacing: "0.06em", fontWeight: 600, minHeight: "var(--control)", padding: "0 0.25rem" }}
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.name}>
                <td className="py-2 pr-2 truncate" style={{ position: "sticky", left: 0, background: "var(--color-surface)", color: "var(--color-cream)", fontWeight: 600, maxWidth: "7rem" }}>{p.name}</td>
                {COLS.map((c) => (
                  <td key={c.key} className="py-2 px-2 text-right" style={{ color: sort.key === c.key ? "var(--color-cream)" : "var(--color-muted)", background: sort.key === c.key ? "color-mix(in srgb, var(--light) 4%, transparent)" : undefined }}>
                    {c.show(c.value(p, ratings.get(p.name) ?? 0))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PerRow({ players }: { players: PlayerRecord[] }) {
  if (players.length === 0) return null;
  const values = players.map((p) => STEPS.map((s) => (p.steps[s].hits + p.steps[s].misses > 0 ? averagePct(p.steps[s]) : null)));
  const range = STEPS.map((_, j) => {
    const col = values.map((v) => v[j]).filter((x): x is number => x !== null);
    return { lo: Math.min(...col), hi: Math.max(...col) };
  });
  return (
    <Card title="TREFF PER RAD" hint="Grønnest er best i raden">
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full tabular" style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: "var(--text-small)", minWidth: "30rem" }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: "var(--color-surface)" }} />
              {STEPS.map((s) => (
                <th key={s} className="pb-1 text-center" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", fontWeight: 600 }}>{STEP_LABELS[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.name}>
                <td className="pr-2 truncate" style={{ position: "sticky", left: 0, background: "var(--color-surface)", color: "var(--color-cream)", fontWeight: 600, maxWidth: "6rem" }}>{p.name}</td>
                {values[i].map((v, j) => {
                  const { lo, hi } = range[j];
                  const t = v === null || hi === lo ? 0 : (v - lo) / (hi - lo);
                  return (
                    <td key={j} className="text-center rounded" style={{ padding: "0.4rem 0.2rem", color: "var(--color-cream)", background: v === null ? "transparent" : `rgba(74,139,92,${(0.12 + 0.55 * t).toFixed(2)})` }}>
                      {v === null ? "–" : Math.round(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Odds on who wins a tournament where everyone plays three matches: tick the sides that are in. */
function TournamentOdds({ roster }: { roster: PlayerRecord[] }) {
  const [kind, setKind] = useState<"player" | "team">("player");
  const inputs = useMemo(() => entrantInputs(roster, RULES, kind), [roster, kind]);
  const [picked, setPicked] = useState<Record<string, boolean | undefined>>({});
  const cache = useRef(new Map<string, Entrant>());
  const [result, setResult] = useState<{ rows: TournamentResult[]; n: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // Until something has been ticked or cleared: the people on the seeding list and anyone with a match behind
  // them, or every team that has played (every team, when none has).
  const anyTeamPlayed = roster.some((r) => r.kind === "team" && r.matchesPlayed > 0);
  const isIn = (name: string) => {
    const set = picked[`${kind}:${name}`];
    if (set !== undefined) return set;
    const rec = roster.find((r) => r.name === name);
    if (!rec) return false;
    if (kind === "team") return !anyTeamPlayed || rec.matchesPlayed > 0;
    return rec.matchesPlayed > 0 || (SEED_ORDER as readonly string[]).includes(name.trim().toLowerCase());
  };
  const chosen = inputs.filter((i) => isIn(i.name));
  const key = chosen.map((c) => `${c.name}|${c.sigmas.map((s) => s.map((x) => x.toFixed(2)).join(",")).join(";")}`).join("#");

  useEffect(() => {
    if (chosen.length < 4) {
      const t = setTimeout(() => setResult(null), 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setBusy(true);
      // Let the "Regner" show before the work starts, then do it.
      setTimeout(() => {
        if (cancelled) return;
        const entrants = chosen.map((c) => {
          const k = `${c.name}|${c.sigmas.map((s) => s.map((x) => x.toFixed(2)).join(",")).join(";")}`;
          let e = cache.current.get(k);
          if (!e) {
            e = entrantFromSigmas(c.name, c.sigmas, RULES);
            cache.current.set(k, e);
          }
          return e;
        });
        const rows = simulateTournament(entrants, { sims: 20000 });
        if (!cancelled) {
          setResult({ rows, n: entrants.length });
          setBusy(false);
        }
      }, 30);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // The calculation follows who is ticked (key); `chosen` is rebuilt every render and would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const n = chosen.length;
  const matches = n >= 4 ? (n % 2 === 0 ? (3 * n) / 2 : (3 * n - 1) / 2) : 0;
  const top = result?.rows[0]?.win ?? 0;
  const noun = kind === "team" ? "lag" : "spillere";

  return (
    <Card title="TURNERINGSODDS" hint="Alle spiller tre kamper">
      <div className="grid grid-cols-2 gap-2 mb-3">
        {(["player", "team"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`tactile rounded-lg ${FOCUS_RING}`}
            style={{ minHeight: "var(--control)", background: kind === k ? "var(--teal-soft)" : "var(--color-cell)", color: kind === k ? "var(--color-teal-strong)" : "var(--color-cream)", border: kind === k ? "1px solid var(--color-teal)" : "1px solid var(--color-border)", fontSize: "var(--text-small)" }}
          >
            {k === "player" ? "Spillere" : "Lag"}
          </button>
        ))}
      </div>

      {inputs.length === 0 ? (
        <p style={{ color: "var(--color-muted)", fontSize: "var(--text-body)" }}>{kind === "team" ? "Ingen lag ennå. Lag opprettes når to spiller sammen." : "Ingen spillere ennå."}</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Hvem er med ({n} valgt)</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setPicked(Object.fromEntries(inputs.map((i) => [`${kind}:${i.name}`, true])))} className={`${FOCUS_RING} rounded-full px-3`} style={{ minHeight: "var(--control)", color: "var(--color-teal-strong)", fontSize: "var(--text-small)" }}>Alle</button>
              <button type="button" onClick={() => setPicked(Object.fromEntries(inputs.map((i) => [`${kind}:${i.name}`, false])))} className={`${FOCUS_RING} rounded-full px-3`} style={{ minHeight: "var(--control)", color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Ingen</button>
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {inputs.map((i) => {
              const on = isIn(i.name);
              return (
                <button
                  key={i.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => ({ ...p, [`${kind}:${i.name}`]: !on }))}
                  className={`tactile rounded-full px-4 ${FOCUS_RING}`}
                  style={{ minHeight: "var(--control)", background: on ? "var(--color-teal)" : "var(--color-cell)", color: on ? "var(--color-bg)" : "var(--color-cream)", border: "1px solid var(--color-border)", fontWeight: 600 }}
                >
                  {on && <CheckIcon className="w-4 h-4 inline-block mr-1 align-text-bottom" />}
                  {i.name}
                </button>
              );
            })}
          </div>

          {n < 4 ? (
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-body)" }}>Velg minst fire {noun} for å se oddsen.</p>
          ) : (
            <>
              <p className="mb-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                {n} {noun}, {matches} kamper.{" "}
                {n % 2 === 0 ? "Alle spiller akkurat tre." : "Med et oddetall kan ikke alle få tre: én, trukket tilfeldig, spiller bare to."}
              </p>
              <div className="space-y-2" aria-busy={busy} style={{ opacity: busy ? 0.5 : 1, transition: "opacity var(--duration-fast) var(--ease-standard)" }}>
                {(result?.rows ?? []).map((r, i) => (
                  <div key={r.name} className="rounded-xl px-3 py-2" style={{ background: i === 0 ? "var(--color-cell-done)" : "var(--color-cell)" }}>
                    <div className="flex items-center gap-3">
                      <span className="font-display w-6 text-center" style={{ color: i === 0 ? "var(--color-gold)" : "var(--color-muted)" }}>{i + 1}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{r.name}</span>
                        <span className="block" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                          Snitt {r.meanWins.toFixed(1).replace(".", ",")} seire · alle {r.matches} vunnet {pct(r.allWins * 100)}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block tabular font-display" style={{ color: "var(--color-gold-strong)", fontSize: "var(--text-title)" }}>{oddsText(r.odds)}</span>
                        <span className="block tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{pct(r.win * 100, r.win < 0.1 ? 1 : 0)}</span>
                      </span>
                    </div>
                    <div className="mt-2 rounded-full overflow-hidden" style={{ height: 5, background: "color-mix(in srgb, var(--shade) 30%, transparent)" }}>
                      <div style={{ width: `${top > 0 ? (r.win / top) * 100 : 0}%`, height: "100%", background: i === 0 ? "var(--color-gold)" : "var(--color-teal)" }} />
                    </div>
                  </div>
                ))}
                {result === null && <p style={{ color: "var(--color-muted)", fontSize: "var(--text-body)" }}>Regner …</p>}
              </div>
              <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                Vinneren er den med flest seire. Står flere likt på toppen, møtes de i ekstrakamper. Hvem som møter hvem trekkes tilfeldig, og det som er usikkert om en spiller teller med: en ukjent spiller er en reell sjanse for en overraskelse. Oddsen er rettferdig (én delt på sjansen) og summerer til 100 %.
                {" "}Eksempel på pris: {oddsText(fairPrice(0.25))} er 25 %.
              </p>
            </>
          )}
        </>
      )}
    </Card>
  );
}
