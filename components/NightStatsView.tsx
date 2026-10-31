"use client";

import { useMemo, useState } from "react";
import { avatarAccent } from "@/lib/avatarAccent";
import type { NightMatch } from "@/lib/nightScore";
import { compare, playerNight, statsOf, teamsOf, type Entity, type HitMap, type Side } from "@/lib/nightStats";
import { Avatar } from "./ui/Avatar";
import { ChartFrame } from "./ui/ChartFrame";
import { Chip } from "./ui/Chip";
import { Section } from "./ui/Section";
import { Sheet } from "./ui/Sheet";
import { FOCUS_RING } from "./ui/focus";

type Photos = Map<string, string | null | undefined>;

const same = (a: Entity, b: Entity) => a.kind === b.kind && a.name === b.name;

/** The statistics of an evening: awards, graphs, the games one by one, two players or teams side by side, and one person's evening. */
export function NightStatsView({ matches, hits, photos }: { matches: NightMatch[]; hits: HitMap; photos: Photos }) {
  const stats = useMemo(() => statsOf(matches, hits), [matches, hits]);
  const [person, setPerson] = useState<string | null>(null);
  if (stats.progress.steps.length === 0) return null;
  return (
    <div>
      {stats.awards.length > 0 && (
        <Section label="Utmerkelser">
          <ul className="ns-awards" aria-label="Utmerkelser">
            {stats.awards.map((a) => (
              <li key={a.key} className="ns-award">
                <small>{a.title}</small>
                <button type="button" className={`ns-who ${FOCUS_RING}`} disabled={a.kind === "team"} onClick={() => setPerson(a.who)}>
                  <Avatar name={a.who} photo={photos.get(a.who)} px={28} />
                  <b>{a.who}</b>
                </button>
                <span className="ns-value tabular">{a.value}</span>
                {a.note && <em>{a.note}</em>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {stats.progress.steps.length >= 2 && (
        <ChartFrame title="POENG GJENNOM KVELDEN" legend={stats.progress.names.map((name) => ({ name }))} caption="Hver kamp er et steg til høyre.">
          <ProgressChart names={stats.progress.names} steps={stats.progress.steps.map((s) => s.points)} />
        </ChartFrame>
      )}

      <ChartFrame title="SEIERE OG TAP">
        <Bars rows={stats.results.map((r) => ({ name: r.name, value: r.wins, total: r.wins + r.losses, label: `${r.wins}–${r.losses}` }))} onOpen={setPerson} />
      </ChartFrame>

      {stats.hits.length > 0 && (
        <ChartFrame title="TREFFPROSENT" caption="Fra Mikke Mus-kampene. En spillers tall er bare fra kamper de spilte alene, lag har sine egne.">
          <Bars rows={stats.hits.map((h) => ({ name: h.name, value: h.pct, total: 100, label: `${Math.round(h.pct)} %`, team: h.kind === "team" }))} onOpen={setPerson} />
        </ChartFrame>
      )}

      <Section label="Hvert spill">
        <ul className="kv-lines" aria-label="Hvert spill">
          {stats.perGame.map((g) => (
            <li key={g.game}>
              <div className="kv-line kv-line--pair">
                <span className="kv-text">
                  <b>{g.name}</b>
                  <small>
                    {g.matches} {g.matches === 1 ? "kamp" : "kamper"}
                  </small>
                </span>
                <span className="kv-score tabular" style={{ fontSize: "var(--text-small)" }}>
                  {g.leader ? `${g.leader.who} · ${g.leader.wins}` : "Ingen klar vinner"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <CompareSection matches={matches} hits={hits} names={stats.results.map((r) => r.name)} />
      {person && <PersonSheet name={person} matches={matches} hits={hits} onClose={() => setPerson(null)} />}
    </div>
  );
}

/** Points after each match, one line per person in their own colour, each named at the end of its line. */
function ProgressChart({ names, steps }: { names: string[]; steps: Record<string, number>[] }) {
  const width = 320;
  const height = 170;
  const padL = 22;
  const padR = 52;
  const padY = 14;
  const max = Math.max(1, ...steps.flatMap((s) => Object.values(s)));
  const n = steps.length;
  const x = (i: number) => padL + ((width - padL - padR) * i) / n;
  const y = (v: number) => padY + (height - padY * 2) * (1 - v / max);
  const ticks = Array.from({ length: Math.min(max, 5) + 1 }, (_, i) => Math.round((max * i) / Math.min(max, 5)));
  // End labels are pushed apart so that two people on the same score can both be read.
  const ends = names.map((name) => ({ name, v: steps[n - 1]?.[name] ?? 0 })).sort((a, b) => a.v - b.v);
  const labelY: Record<string, number> = {};
  let last = Infinity;
  for (const e of [...ends].reverse()) {
    const wanted = y(e.v);
    labelY[e.name] = Math.min(wanted, last - 13);
    last = labelY[e.name];
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Poeng gjennom kvelden">
      {[...new Set(ticks)].map((t) => (
        <g key={t}>
          <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} />
          <text x={padL - 5} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-muted)">
            {t}
          </text>
        </g>
      ))}
      {names.map((name) => {
        const pts = [0, ...steps.map((s) => s[name] ?? 0)];
        // Stepped: a point is won in one match, not between two.
        const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
        const color = avatarAccent(name);
        return (
          <g key={name}>
            <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={x(n)} cy={y(pts[n])} r={4} fill={color} stroke="var(--color-panel)" strokeWidth={2} />
            <text x={x(n) + 8} y={labelY[name]} dominantBaseline="middle" fontSize={11} fontWeight={700} fill="var(--color-cream)">
              {name.length > 7 ? `${name.slice(0, 6)}…` : name} {pts[n]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type BarRow = { name: string; value: number; total: number; label: string; team?: boolean };

/** One bar per name, as long as its share of `total`, with the figure at the end. */
function Bars({ rows, onOpen }: { rows: BarRow[]; onOpen: (name: string) => void }) {
  return (
    <ul className="ns-bars">
      {rows.map((r) => (
        <li key={r.name}>
          <button type="button" className={`ns-bar-name ${FOCUS_RING}`} disabled={r.team} onClick={() => onOpen(r.name)}>
            {r.name}
          </button>
          <span className="ns-bar" aria-hidden>
            <i style={{ width: `${Math.max(2, Math.min(100, r.total > 0 ? (r.value / r.total) * 100 : 0))}%`, background: avatarAccent(r.name) }} />
          </span>
          <span className="tabular ns-bar-value">{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

const FIELDS: { label: string; get: (s: Side) => number | null; show: (v: number) => string; lowerIsBetter?: boolean }[] = [
  { label: "Seiere", get: (s) => s.wins, show: String },
  { label: "Tap", get: (s) => s.losses, show: String, lowerIsBetter: true },
  { label: "Poeng", get: (s) => s.points, show: String },
  { label: "Treffprosent", get: (s) => s.hitPct, show: (v) => `${Math.round(v)} %` },
  { label: "Snitt per runde", get: (s) => s.average, show: (v) => String(Math.round(v * 10) / 10) },
  { label: "Beste runde", get: (s) => (s.best > 0 ? s.best : null), show: String },
  { label: "Beste utsjekk", get: (s) => (s.finish > 0 ? s.finish : null), show: String },
  { label: "Runder på 100+", get: (s) => (s.tons > 0 ? s.tons : null), show: String },
  { label: "180", get: (s) => (s.s180 > 0 ? s.s180 : null), show: String },
];

/** Two players or two teams side by side: the duels between them first, then the figures with the better one marked. */
function CompareSection({ matches, hits, names }: { matches: NightMatch[]; hits: HitMap; names: string[] }) {
  const teams = useMemo(() => teamsOf(matches), [matches]);
  const entities: Entity[] = useMemo(() => [...names.map((name) => ({ kind: "player" as const, name })), ...teams.map((name) => ({ kind: "team" as const, name }))], [names, teams]);
  const [a, setA] = useState<Entity | null>(null);
  const [b, setB] = useState<Entity | null>(null);
  const left = a ?? entities[0];
  const right = b ?? entities.find((e) => e.kind === left?.kind && !same(e, left)) ?? entities[1];
  if (!left || !right) return null;
  const c = compare(matches, hits, left, right);
  const pick = (current: Entity, set: (e: Entity) => void, other: Entity, label: string) => (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {entities.map((e) => (
        <Chip key={`${e.kind}-${e.name}`} selected={same(e, current)} onClick={() => !same(e, other) && set(e)}>
          {e.name}
        </Chip>
      ))}
    </div>
  );
  return (
    <Section label="Sammenlign to">
      <div className="space-y-2 mb-3">
        {pick(left, setA, right, "Første")}
        {pick(right, setB, left, "Andre")}
      </div>
      <div className="ns-compare" role="table" aria-label="Sammenligning">
        <div className="ns-compare-head" role="row">
          <b role="columnheader">{left.name}</b>
          <span role="columnheader" />
          <b role="columnheader">{right.name}</b>
        </div>
        <div className="ns-compare-row ns-compare-duel" role="row">
          <span className="tabular" role="cell">{c.duels.a}</span>
          <small role="rowheader">Dueller mot hverandre</small>
          <span className="tabular" role="cell">{c.duels.b}</span>
        </div>
        {FIELDS.map((f) => {
          const av = f.get(c.a);
          const bv = f.get(c.b);
          if (av === null && bv === null) return null;
          const better = av !== null && bv !== null && av !== bv ? ((av > bv) !== !!f.lowerIsBetter ? "a" : "b") : null;
          return (
            <div key={f.label} className="ns-compare-row" role="row">
              <span className={`tabular ${better === "a" ? "ns-better" : ""}`} role="cell">{av === null ? "–" : f.show(av)}</span>
              <small role="rowheader">{f.label}</small>
              <span className={`tabular ${better === "b" ? "ns-better" : ""}`} role="cell">{bv === null ? "–" : f.show(bv)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
        Snitt, runder og utsjekk finnes bare for kamper som er spilt etter at tallene ble lagret.
      </p>
    </Section>
  );
}

/** One person's evening. */
function PersonSheet({ name, matches, hits, onClose }: { name: string; matches: NightMatch[]; hits: HitMap; onClose: () => void }) {
  const p = useMemo(() => playerNight(matches, hits, name), [matches, hits, name]);
  const steps = p.progress.map((s) => ({ [name]: s.points }));
  return (
    <Sheet title={`${name} i kveld`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Fact label="POENG">{p.stats.points ?? 0}</Fact>
        <Fact label="SEIERE–TAP">
          {p.stats.wins}–{p.stats.losses}
        </Fact>
        <Fact label="TREFF">{p.stats.hitPct === null ? "–" : `${Math.round(p.stats.hitPct)} %`}</Fact>
      </div>
      {steps.length >= 2 && (
        <div className="mb-4">
          <p className="section-label mb-2">POENG GJENNOM KVELDEN</p>
          <ProgressChart names={[name]} steps={steps} />
        </div>
      )}
      {p.games.length > 0 && (
        <div className="mb-4">
          <p className="section-label mb-2">I HVERT SPILL</p>
          <ul className="space-y-1">
            {p.games.map((g) => (
              <li key={g.game} className="flex justify-between" style={{ color: "var(--color-cream)" }}>
                <span>{g.name}</span>
                <span className="tabular" style={{ fontWeight: 700 }}>
                  {g.wins}–{g.losses}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="space-y-1" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
        {p.bestMate && (
          <li>
            Beste makker: <b style={{ color: "var(--color-cream)" }}>{p.bestMate.name}</b> ({p.bestMate.won}–{p.bestMate.lost})
          </li>
        )}
        {p.mostBeaten && (
          <li>
            Mest slått: <b style={{ color: "var(--color-cream)" }}>{p.mostBeaten.name}</b> ({p.mostBeaten.won}–{p.mostBeaten.lost})
          </li>
        )}
      </ul>
    </Sheet>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cell-tile rounded-lg p-3 text-center flex flex-col justify-center" style={{ minHeight: "4.5rem" }}>
      <p style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", letterSpacing: "0.05em" }}>{label}</p>
      <p className="tabular font-display" style={{ color: "var(--color-cream)", fontSize: "var(--text-num)", fontWeight: 600, lineHeight: 1.1 }}>
        {children}
      </p>
    </div>
  );
}
