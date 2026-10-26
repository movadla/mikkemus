import type { ReactNode } from "react";
import { avatarAccent } from "@/lib/avatarAccent";

/**
 * The frame of every chart: a card with the name of the chart above, the chart itself, and under it a legend and a line that says
 * what to see. The series are the players' own colours (the ones on their pictures), so the same person is the same colour in
 * every chart of the app.
 */
export function ChartFrame({ title, children, legend, caption }: { title: string; children: ReactNode; legend?: { name: string; won?: boolean }[]; caption?: ReactNode }) {
  return (
    <div className="card mb-6">
      <p className="mb-4 section-label">{title}</p>
      {children}
      {legend && legend.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3" style={{ fontSize: "var(--text-small)" }}>
          {legend.map((l) => (
            <span key={l.name} className="inline-flex items-center gap-2" style={{ color: "var(--color-muted)" }}>
              <i className="inline-block rounded-full" style={{ width: 8, height: 8, background: avatarAccent(l.name) }} />
              {l.name}
              {l.won ? " (vant)" : ""}
            </span>
          ))}
        </div>
      )}
      {caption && (
        <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
          {caption}
        </p>
      )}
    </div>
  );
}

/** The colour of a series: the one that belongs to the player. */
export const seriesColor = avatarAccent;
