"use client";

import { DARTS, HOMES, PLACES, TIERS, dollars, type Career } from "@/lib/career";
import { nextRank, rankOf } from "@/lib/careerGoals";
import { teamKitsOf, useRoster } from "@/lib/storage";
import { levelLabel, oneDecimal } from "./careerFormat";
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
  const place = HOMES.find((h) => h.id === career.profile.home)?.name ?? PLACES.find((p) => p.id === career.profile.home)?.name ?? "";
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
          <p style={{ color: "var(--color-gold-strong)", fontWeight: 700 }}>{rankOf(career)}</p>
        </div>
      </div>
      {next && (
        <div>
          <div className="flex justify-between tabular" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
            <span>{career.points} poeng</span>
            <span>{next.name} ved {next.min}</span>
          </div>
          <div className="mt-1" role="progressbar" aria-label={`Veien til ${next.name}`} aria-valuemin={0} aria-valuemax={next.min} aria-valuenow={career.points} style={{ height: "0.45rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (career.points / next.min) * 100)}%`, height: "100%", background: "var(--color-gold)" }} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Turneringer" value={String(career.played)} />
        <Stat label="Titler" value={String(career.titles)} />
        <Stat label="Nivå" value={levelLabel(career.skillMed)} />
      </div>
      <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
        {place} · {darts} dart · MED {oneDecimal(career.skillMed)} mm · saldo {dollars(career.money)}
      </p>
      <section aria-label="Pokaler">
        <p className="section-label mb-2">POKALER</p>
        {career.trophies.length === 0 ? (
          <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Ingen ennå. Den første kan komme allerede i Lü-cupen.</p>
        ) : (
          <ul className="space-y-1">
            {career.trophies.map((t) => (
              <li key={t.at} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-small)" }}>
                <span style={{ color: "var(--color-cream)", fontWeight: 600 }}>{TIERS[t.tier].trophy}</span>
                <span className="tabular" style={{ color: "var(--color-muted)" }}>
                  {t.at.slice(0, 10)} · {dollars(t.prize)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
