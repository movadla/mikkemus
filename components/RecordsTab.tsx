"use client";

import Link from "next/link";
import { useMemo } from "react";
import { buildRecords } from "@/lib/records";
import { useRoster } from "@/lib/storage";

const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";
const MEDAL = ["var(--color-gold)", "var(--color-muted)", "#b87333"];

/** The group's records: for each, the best three. Tap a name to open that player. */
export function RecordsTab() {
  const roster = useRoster();
  const lists = useMemo(() => buildRecords(roster), [roster]);
  if (lists.length === 0) {
    return (
      <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
        Ingen rekorder ennå
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {lists.map((l) => (
        <section key={l.key} className="card" style={{ background: "var(--color-surface)" }}>
          <h2 className="section-label mb-3">{l.title.toUpperCase()}</h2>
          <ol className="space-y-2">
            {l.holders.map((h, i) => (
              <li key={`${h.name}-${i}`}>
                <Link href={`/spillere/${encodeURIComponent(h.name)}`} className={`flex items-center gap-3 rounded-lg ${FOCUS_RING}`} style={{ minHeight: "var(--control)" }}>
                  <span className="font-display shrink-0 w-6 text-center" style={{ color: MEDAL[i], fontSize: "var(--text-title)" }}>{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: i === 0 ? 700 : 500 }}>{h.name}</span>
                    {h.note && <span className="block truncate tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{h.note}</span>}
                  </span>
                  <span className="tabular shrink-0" style={{ color: i === 0 ? "var(--color-gold-strong)" : "var(--color-teal-strong)", fontSize: "var(--text-body)", fontWeight: 700 }}>{l.format(h.value)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
