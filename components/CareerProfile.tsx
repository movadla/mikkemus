"use client";

import { DARTS, PLACE_LABEL, STAGES, TIERS, dollars, type Career } from "@/lib/career";
import { nextRank, rankOf } from "@/lib/careerGoals";
import { teamKitsOf, useRoster } from "@/lib/storage";
import { levelLabel, oneDecimal } from "./careerFormat";
import { PokalCard, RankBadge } from "./CareerTrophy";
import { TeamKit } from "./TeamKit";
import { Avatar } from "./ui/Avatar";

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
 * the career so far and the cups that have been won. Opened from the menu on the home screen.
 */
export function CareerProfile({ career }: { career: Career }) {
  const roster = useRoster();
  const record = roster.find((r) => r.name === career.player);
  const next = nextRank(career);
  const darts = DARTS.find((d) => d.id === career.profile.darts)?.name ?? "";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={career.player} photo={record?.photo} size="xl" state="winner" />
        {record && <TeamKit kit={teamKitsOf(record).home} size={64} title="Skjorten din" />}
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
      <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
        Rom: {STAGES[career.room].name} · {darts.toLowerCase()} piler · avvik {oneDecimal(career.skillMed)} mm · saldo {dollars(career.money)}
      </p>
      {career.history.length > 0 && (
        <section aria-label="Siste">
          <p className="section-label mb-2">SISTE</p>
          <ul className="space-y-1">
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
        </section>
      )}
      <section aria-label="Pokaler">
        <p className="section-label mb-2">POKALER</p>
        {career.trophies.length === 0 ? (
          <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Ingen pokaler ennå</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {career.trophies.map((t) => (
              <li key={t.at}>
                <PokalCard kind={t.tier} name={TIERS[t.tier].trophy} date={t.at.slice(0, 10)} prize={dollars(t.prize)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
