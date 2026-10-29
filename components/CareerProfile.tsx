"use client";

import { useState } from "react";
import { DARTS, PLACE_LABEL, STAGES, START_LEVELS, TIERS, dollars, type Career } from "@/lib/career";
import { nextRank, rankOf } from "@/lib/careerGoals";
import { lifeOf, rivalOf, seasonOf, sponsorLogo, weekInSeason, WEEKS_PER_SEASON } from "@/lib/careerLife";
import { levelLabel } from "./careerFormat";
import { PokalCard, RankBadge } from "./CareerTrophy";
import { CharacterFace } from "./CharacterFigure";
import { TrophyCabinet } from "./TrophyCabinet";
import { Button } from "./ui/Button";
import { FOCUS_RING } from "./ui/focus";

/** One number with its name under it. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center" style={{ padding: "0.5rem 0.25rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <span className="num block tabular" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
        {value}
      </span>
      <span style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>{label}</span>
    </div>
  );
}

export type ProfileTab = "oversikt" | "sesonger" | "pokaler";
const TABS: { id: ProfileTab; label: string }[] = [
  { id: "oversikt", label: "Oversikt" },
  { id: "sesonger", label: "Sesonger" },
  { id: "pokaler", label: "Pokaler" },
];

/**
 * Who the player is in the career: the face in a ring that fills towards the next title, and three tabs: the overview (the numbers of the
 * career, the rival, the sponsor), the seasons with the last tournaments, and the cups, in the cabinet and as cards.
 */
export function CareerProfile({ career, onRank, tab: first = "oversikt" }: { career: Career; onRank?: () => void; tab?: ProfileTab }) {
  const [tab, setTab] = useState<ProfileTab>(first);
  const next = nextRank(career);
  const darts = DARTS.find((d) => d.id === career.profile.darts)?.name ?? "";
  const life = lifeOf(career);
  const rival = rivalOf(career);
  const startName = START_LEVELS.find((l) => l.key === career.startLevel)?.name ?? levelLabel(career.skillMed);
  const progress = next ? Math.min(1, career.points / next.min) : 1;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span
          className="pf-ring"
          role={next ? "progressbar" : undefined}
          aria-label={next ? `Neste rang: ${next.name}` : undefined}
          aria-valuemin={next ? 0 : undefined}
          aria-valuemax={next ? next.min : undefined}
          aria-valuenow={next ? career.points : undefined}
          style={{ "--p": `${Math.round(progress * 100)}%` } as React.CSSProperties}
        >
          <CharacterFace id={career.profile.character} px={76} />
        </span>
        <div className="min-w-0">
          <p className="font-display truncate" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1.05 }}>
            {career.player}
          </p>
          <p className="rank-line" style={{ color: "var(--color-gold-strong)", fontWeight: 700 }}>
            <RankBadge rank={rankOf(career)} />
            {rankOf(career)}
          </p>
          {next && (
            <p className="tabular" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
              {career.points} av {next.min} poeng til {next.name}
            </p>
          )}
        </div>
      </div>

      <div className="pf-tabs" role="tablist" aria-label="Profil">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`pf-tab tactile ${FOCUS_RING}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "oversikt" && (
        <div className="space-y-4" role="tabpanel" aria-label="Oversikt">
          {onRank && (
            <Button block onClick={onRank}>
              Se rangeringen
            </Button>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Turneringer" value={String(career.played)} />
            <Stat label="Titler" value={String(career.titles)} />
            <Stat label="Treffsikkerhet" value={levelLabel(career.skillMed)} />
          </div>
          <dl className="pf-card">
            <div className="pf-row">
              <dt>Sesong</dt>
              <dd>
                {seasonOf(life.week)} · uke {weekInSeason(life.week)} av {WEEKS_PER_SEASON}
              </dd>
            </div>
            <div className="pf-row">
              <dt>Utvikling</dt>
              <dd>
                {startName === levelLabel(career.skillMed) ? levelLabel(career.skillMed) : `${startName} → ${levelLabel(career.skillMed)}`}
                <small>
                  {career.training.length} treningsøkter · {career.played} turneringer
                </small>
              </dd>
            </div>
            <div className="pf-row">
              <dt>Rival</dt>
              <dd>
                {rival.name}
                <small>
                  {rival.style} · {career.rivals?.[rival.name] ? `${career.rivals?.[rival.name].w}–${career.rivals?.[rival.name].l}` : "ikke møtt"}
                </small>
              </dd>
            </div>
            <div className="pf-row">
              <dt>Rykte</dt>
              <dd>
                <span className="pf-bar" role="img" aria-label={`Rykte ${life.reputation} av 10`}>
                  <i style={{ width: `${life.reputation * 10}%` }} />
                </span>
              </dd>
            </div>
            {life.sponsor && (
              <div className="pf-row">
                <dt>Sponsor</dt>
                <dd className="pf-sponsor">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sponsorLogo(life.sponsor.name)} alt="" className="sponsor-logo" width={44} height={44} draggable={false} />
                  <span>
                    {life.sponsor.name}
                    <small>{life.sponsor.left} turneringer igjen</small>
                  </span>
                </dd>
              </div>
            )}
            <div className="pf-row">
              <dt>Rom</dt>
              <dd>{STAGES[career.room].name}</dd>
            </div>
            <div className="pf-row">
              <dt>Piler</dt>
              <dd>{darts}</dd>
            </div>
          </dl>
        </div>
      )}

      {tab === "sesonger" && (
        <div className="space-y-4" role="tabpanel" aria-label="Sesonger">
          {life.seasons.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Ingen avsluttede sesonger ennå</p>
          ) : (
            <ul className="pf-list">
              {life.seasons.slice(0, 8).map((s) => (
                <li key={s.season} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                  <span className="truncate">
                    Sesong {s.season} · nr. {s.rank}
                    {s.rank === 1 ? " · årets spiller" : ` · vinner ${s.winner}`}
                  </span>
                  <span className="tabular shrink-0" style={{ color: "var(--color-muted)" }}>
                    {s.prize > 0 ? `+${dollars(s.prize)}` : "ingen premie"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {career.history.length > 0 && (
            <>
              <p className="section-label">SISTE TURNERINGER</p>
              <ul className="pf-list">
                {career.history.slice(0, 8).map((h) => (
                  <li key={h.at} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                    <span className="truncate">{h.place ? `${h.event} · ${PLACE_LABEL[h.place]}` : `${h.event} · ${h.won ? "vant" : "tapt"}`}</span>
                    <span className="tabular shrink-0" style={{ color: "var(--color-muted)" }}>
                      {h.prize - h.cost > 0 ? "+" : ""}
                      {dollars(h.prize - h.cost)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === "pokaler" && (
        <div className="space-y-4" role="tabpanel" aria-label="Pokaler">
          <TrophyCabinet career={career} />
          {career.trophies.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Ingen pokaler ennå</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {career.trophies.map((t) => (
                <li key={t.at}>
                  <PokalCard kind={t.tier} name={t.name ?? TIERS[t.tier].trophy} date={t.at.slice(0, 10)} prize={dollars(t.prize)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
