/* eslint-disable @next/next/no-img-element -- fixed portraits from public/career */
import type { CSSProperties, ReactNode } from "react";
import type { Rival } from "@/lib/career";
import { MATERIALS, type MaterialName } from "@/lib/materials";
import { characterOf, poseSrc } from "@/lib/characters";
import { NATION, opponentOf, portraitSrc } from "@/lib/opponents";
import { norwayRankOf, playerWorldRank, winChance, worldRankFor } from "@/lib/opponentStats";
import { statsFor, type CareerGameSettings } from "@/lib/careerGame";

/** What the player brings to a comparison: how sharp they are, the points that have moved them up the list, who they are in the career, and what they have done against each opponent. */
export type Me = { name: string; med: number; points: number; character?: string; /** In a cup of teams: the names of the player's team, the player first. */ members?: string[]; /** The player's rival: the same one for the whole career, marked wherever they are met. */ rival?: { name: string; style: string }; rivals?: Record<string, Rival>; /** The game the career is played in, which decides what the figures are. Mikke Mus when it is not given. */ settings?: CareerGameSettings };

const MM: CareerGameSettings = { game: "mm", doubleOut: true };

/** The metal of a frame from the world rank: the best are diamond, the rest follow down to bronze. */
export const metalOfRank = (rank: number): MaterialName => (rank < 60 ? "diamond" : rank < 120 ? "chrome" : rank < 200 ? "gold" : rank < 300 ? "silver" : "bronze");

const frameOf = (m: MaterialName) => {
  const p = MATERIALS[m];
  return `linear-gradient(145deg, ${p.hi}, ${p.m} 40%, ${p.d} 60%, ${p.l})`;
};

/** The ranks of a person: the world list for everyone, and the Norwegian one for Norwegians. */
export function ranksOf(name: string, nat: string, med: number, me?: Me) {
  const world = me && name === me.name ? playerWorldRank(me.med, me.points) : worldRankFor(name, med);
  return { world, norway: nat === "NOR" ? norwayRankOf(world) : null };
}

/** A portrait in a frame of metal: the face of an opponent, or the player's character. */
export function PortraitFrame({ src, metal, label, onClick, children, tint }: { src: string; metal: MaterialName; label: string; onClick?: () => void; children?: ReactNode; /** A colour behind a figure with a transparent background. */ tint?: string }) {
  const inner = (
    <span className="opp-frame" style={{ "--frame": frameOf(metal), ...(tint ? { "--tint": tint } : {}) } as CSSProperties}>
      <span className="opp-frame-in">
        <img src={src} alt="" draggable={false} style={tint ? { objectPosition: "50% 0%", transform: "scale(1.15)", transformOrigin: "50% 0" } : undefined} />
        {children}
      </span>
    </span>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={label} className="opp-frame-btn tactile">
      {inner}
    </button>
  ) : (
    inner
  );
}

/** The face of an opponent in a frame, the metal following its rank. */
export function OpponentPortrait({ name, onClick }: { name: string; onClick?: () => void }) {
  const o = opponentOf(name);
  return <PortraitFrame src={portraitSrc(name)} metal={metalOfRank(worldRankFor(name, o.med))} label={`Se ${name}`} onClick={onClick} />;
}

/** A team in a frame: the faces of the two side by side, the player's own as their character. */
export function TeamPortrait({ members, me, metal = "chrome", label, onClick }: { members: string[]; me?: { name: string; character?: string }; metal?: MaterialName; label: string; onClick?: () => void }) {
  const inner = (
    <span className="opp-frame" style={{ "--frame": frameOf(metal) } as CSSProperties}>
      <span className="opp-frame-in opp-frame-team">
        {members.slice(0, 2).map((m) => {
          const mine = m === me?.name;
          const c = characterOf(me?.character);
          return (
            <span key={m} className="opp-team-pic" style={mine ? ({ background: c.tint } as CSSProperties) : undefined}>
              <img src={mine ? poseSrc(c, "noytral") : portraitSrc(m)} alt="" draggable={false} style={mine ? { objectPosition: "50% 0%", transform: "scale(1.15)", transformOrigin: "50% 0" } : undefined} />
            </span>
          );
        })}
      </span>
    </span>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={label} className="opp-frame-btn tactile">
      {inner}
    </button>
  ) : (
    inner
  );
}

/** The player's character in a frame of gold. */
export function MePortrait({ me }: { me: Me }) {
  const c = characterOf(me.character);
  return <PortraitFrame src={poseSrc(c, "noytral")} metal="gold" label={me.name} tint={c.tint} />;
}

type Row = { label: string; mine: number; theirs: number; better: "low" | "high"; format?: (n: number) => string };

/** The rows that set the two side by side: rank, the average, how often the 20 is hit and the doubles. The better of each pair is lit. */
export function CompareRows({ me, opponent, med }: { me: Me; opponent: string; med: number }) {
  const o = opponentOf(opponent);
  const mine = ranksOf(me.name, "NOR", me.med, me);
  const theirs = ranksOf(opponent, o.nat, o.med);
  const settings = me.settings ?? MM;
  const a = statsFor(settings, me.med);
  const b = statsFor(settings, med);
  const team = !!me.members;
  const rows: Row[] = [
    ...(team ? [] : [{ label: "Verdensrang", mine: mine.world, theirs: theirs.world, better: "low" as const, format: (n: number) => `#${n}` }]),
    // Only the first figure of the game (the hit share, or the average): the chance of winning says the rest, and it is the bigger thing on the screen.
    ...a.slice(0, 1).map((s, i) => ({ label: s.label, mine: s.value, theirs: b[i].value, better: s.better, format: s.suffix ? (n: number) => `${n}${s.suffix}` : undefined })),
  ];
  return (
    <div className="tape-rows" role="table" aria-label="Du mot motstanderen">
      {rows.map((r, i) => {
        const f = r.format ?? String;
        const win = r.mine === r.theirs ? "" : (r.better === "low" ? r.mine < r.theirs : r.mine > r.theirs) ? "l" : "r";
        const top = Math.max(r.mine, r.theirs) * 1.15 || 1;
        const bar = (n: number) => (r.better === "low" ? Math.max(8, 100 - (n / top) * 100 + 8) : (n / top) * 100);
        return (
          <div key={r.label} className="tape-row" role="row" style={{ "--d": `${1.0 + i * 0.14}s` } as CSSProperties}>
            <span className={`tape-v tape-l ${win === "l" ? "tape-win" : ""}`} role="cell">
              <b>{f(r.mine)}</b>
              <i style={{ "--w": `${bar(r.mine)}%` } as CSSProperties} />
            </span>
            <span className="tape-lb" role="rowheader">
              {r.label}
            </span>
            <span className={`tape-v tape-r ${win === "r" ? "tape-win" : ""}`} role="cell">
              <b>{f(r.theirs)}</b>
              <i style={{ "--w": `${bar(r.theirs)}%` } as CSSProperties} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The chance of winning as a figure and a bar. */
export function ChanceMeter({ me, med }: { me: Me; med: number }) {
  const p = winChance(me.med, med);
  return (
    <div className="chance" role="img" aria-label={`Din sjanse: ${p} prosent`}>
      <span className="chance-ring" style={{ "--p": `${p}%` } as CSSProperties}>
        <span className="chance-n">{p} %</span>
      </span>
      <small className="chance-cap">DIN SJANSE</small>
    </div>
  );
}

/** What the player has done against this opponent, as a line: 1 – 0 and who won last. */
export function recordLine(rival: Rival | undefined): { score: string; last: string } {
  if (!rival || rival.w + rival.l === 0) return { score: "0 – 0", last: "aldri møtt" };
  return { score: `${rival.w} – ${rival.l}`, last: `${rival.lastWon ? "seier" : "tap"}, ${rival.last.slice(0, 10)}` };
}

/** The profile of an opponent: the portrait, where they come from, where they stand, the numbers, how they throw and the record against the player. */
export function OpponentProfile({ name, med, me }: { name: string; med: number; me?: Me }) {
  const o = opponentOf(name);
  const r = ranksOf(name, o.nat, o.med);
  const stats = statsFor(me?.settings ?? MM, med);
  const rec = recordLine(me?.rivals?.[name]);
  return (
    <div className="opp-profile">
      <div className="opp-profile-head">
        <div className="opp-profile-pic">
          <PortraitFrame src={portraitSrc(name)} metal={metalOfRank(r.world)} label={name} />
        </div>
        <div className="min-w-0">
          <p className="font-display opp-profile-name">{name}</p>
          <p className="opp-chips">
            {me?.rival?.name === name && <span className="opp-chip opp-chip-gold">Din rival</span>}
            <span className="opp-chip">{NATION[o.nat] ?? o.nat}</span>
            <span className="opp-chip opp-chip-gold">Verden #{r.world}</span>
            {r.norway !== null && <span className="opp-chip opp-chip-gold">Norge #{r.norway}</span>}
          </p>
        </div>
      </div>
      {o.job && <p className="opp-job">{o.job}</p>}
      {me?.rival?.name === name && (
        <p className="opp-chips">
          <span className="opp-chip opp-chip-teal">{me.rival.style}</span>
        </p>
      )}
      {o.styles[0] && (
        <p className="opp-chips">
          {o.styles.map((s) => (
            <span key={s} className="opp-chip opp-chip-teal">
              {s}
            </span>
          ))}
        </p>
      )}
      <div className="opp-stats" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
        {stats.map((s) => (
          <div key={s.key}>
            <b>
              {s.value}
              {s.suffix}
            </b>
            <small>{s.short}</small>
          </div>
        ))}
      </div>
      {me && (
        <div className="opp-record">
          <span>
            {me.name} mot {name}
            <br />
            Siste: {rec.last}
          </span>
          <b>{rec.score}</b>
        </div>
      )}
    </div>
  );
}
