import type { Goal } from "@/lib/careerGoals";
import { LockIcon } from "./careerIcons";

const COLOUR: Record<Goal["id"], string> = { tournament: "var(--color-teal)", rank: "var(--color-gold)", room: "var(--color-green)" };
const LABEL: Record<Goal["id"], string> = { tournament: "NESTE STEG", rank: "NESTE TITTEL", room: "NESTE FOR ROMMET" };

/**
 * The goals nearest at hand, each with a bar that shows how far there is to go. This is what the player is playing for between two
 * tournaments: the money for the next step, the points for the next title, the price of the next thing for the room.
 */
export function CareerGoals({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return null;
  return (
    <section aria-label="Neste mål" className="space-y-2">
      <p className="section-label">NESTE MÅL</p>
      <ul className="space-y-2">
        {goals.map((g) => (
          <li key={g.id} style={{ padding: "0.7rem 0.85rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display truncate" style={{ fontSize: "var(--text-body)", color: "var(--color-cream)", fontWeight: 600 }}>
                {g.title}
              </p>
              <span style={{ color: COLOUR[g.id], fontSize: "var(--text-micro)", letterSpacing: "0.08em", fontWeight: 700 }}>{LABEL[g.id]}</span>
            </div>
            <p className="flex items-center gap-1" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
              {g.progress === null && <LockIcon className="w-3.5 h-3.5 shrink-0" />}
              {g.line}
            </p>
            {g.progress !== null && (
              <>
                <div className="mt-2" role="progressbar" aria-label={g.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(g.progress * 100)} style={{ height: "0.4rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(3, g.progress * 100)}%`, height: "100%", borderRadius: "var(--radius-pill)", background: COLOUR[g.id], transition: "width var(--pull)" }} />
                </div>
                {g.note && (
                  <p className="tabular mt-1" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
                    {g.note}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
