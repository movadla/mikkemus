"use client";

import { DARTS, PLACE_LABEL, STAGES, START_LEVELS, TIERS, dollars, type Career } from "@/lib/career";
import { nextRank, rankOf } from "@/lib/careerGoals";
import { lifeOf, rivalOf, seasonOf, weekInSeason, WEEKS_PER_SEASON } from "@/lib/careerLife";
import { levelLabel } from "./careerFormat";
import { PokalCard, RankBadge } from "./CareerTrophy";
import { CharacterFace } from "./CharacterFigure";

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

/**
 * Who the player is in the career: the shirt and the face, the title the points have given and how far there is to the next, the numbers of
 * the career so far and the cups that have been won. Its own place on the home screen.
 */
export function CareerProfile({ career }: { career: Career }) {
  const next = nextRank(career);
  const darts = DARTS.find((d) => d.id === career.profile.darts)?.name ?? "";
  const life = lifeOf(career);
  const rival = rivalOf(career);
  const startName = START_LEVELS.find((l) => l.key === career.startLevel)?.name ?? levelLabel(career.skillMed);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <CharacterFace id={career.profile.character} px={88} />
        <div className="min-w-0">
          <p className="font-display truncate" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1.05 }}>
            {career.player}
          </p>
          <p className="rank-line" style={{ color: "var(--color-gold-strong)", fontWeight: 700 }}>
            <RankBadge rank={rankOf(career)} />
            {rankOf(career)}
          </p>
        </div>
      </div>
      {next && (
        <div>
          <div className="flex justify-between tabular" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
            <span>{career.points} poeng</span>
            <span>{next.name} ved {next.min}</span>
          </div>
          <div className="mt-1" role="progressbar" aria-label={`Neste rang: ${next.name}`} aria-valuemin={0} aria-valuemax={next.min} aria-valuenow={career.points} style={{ height: "0.45rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (career.points / next.min) * 100)}%`, height: "100%", background: "var(--color-gold)" }} />
          </div>
        </div>
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
            <dd>
              {life.sponsor.name}
              <small>{life.sponsor.left} turneringer igjen</small>
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
      {life.seasons.length > 0 && (
        <details className="pf-sec" aria-label="Sesonger" open>
          <summary className="section-label">SESONGER</summary>
          <ul className="pf-list">
            {life.seasons.slice(0, 5).map((s) => (
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
        </details>
      )}
      {career.history.length > 0 && (
        <details className="pf-sec" aria-label="Siste">
          <summary className="section-label">SISTE TURNERINGER</summary>
          <ul className="pf-list">
            {career.history.slice(0, 6).map((h) => (
              <li key={h.at} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                <span className="truncate">{h.place ? `${h.event} · ${PLACE_LABEL[h.place]}` : `${h.event} · ${h.won ? "vant" : "tapt"}`}</span>
                <span className="tabular shrink-0" style={{ color: "var(--color-muted)" }}>
                  {h.prize - h.cost > 0 ? "+" : ""}
                  {dollars(h.prize - h.cost)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="pf-sec" aria-label="Pokaler" open>
        <summary className="section-label">POKALER</summary>
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
      </details>
    </div>
  );
}
