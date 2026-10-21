"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildMatchLog, type MatchRow } from "@/lib/matchLog";
import { listArchivedIds } from "@/lib/matchArchive";
import { useRoster } from "@/lib/storage";
import { shownHitPct } from "@/lib/playerRows";

const PAGE_SIZE = 10;
const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

const two = (n: number) => String(n).padStart(2, "0");
/** 2026-10-17 18:20, in the viewer's own time. */
function when(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function resultText(m: MatchRow): string {
  if (!m.winner) return "Ukjent resultat";
  return m.margin !== null && m.margin > 0 ? `${m.winner} vant med ${m.margin} ${m.margin === 1 ? "strek" : "streker"}` : `${m.winner} vant`;
}

function Card({ m, archived }: { m: MatchRow; archived: boolean }) {
  return (
    <div className="px-4 pb-4 pt-1">
      <p className="mb-3" style={{ color: "var(--color-gold-strong)", fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>{resultText(m)}</p>
      <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${Math.min(2, m.sides.length)}, minmax(0, 1fr))` }}>
        {m.sides.map((s) => (
          <div key={s.name} className="rounded-lg p-3" style={{ background: "var(--color-cell)", border: s.won ? "1px solid var(--color-gold)" : "1px solid transparent" }}>
            <p className="truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{s.name}</p>
            {s.members && <p className="truncate" style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>{s.members.join(", ")}</p>}
            {s.entry ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 tabular" style={{ fontSize: "0.8rem" }}>
                <dt style={{ color: "var(--color-muted)" }}>Treff</dt>
                <dd className="text-right" style={{ color: "var(--color-teal-strong)", fontWeight: 700 }}>{Math.round(shownHitPct(s.entry))} %</dd>
                <dt style={{ color: "var(--color-muted)" }}>Piler</dt>
                <dd className="text-right" style={{ color: "var(--color-cream)" }}>{s.entry.dartsUsed}</dd>
                {s.entry.med !== null && (
                  <>
                    <dt style={{ color: "var(--color-muted)" }}>MED</dt>
                    <dd className="text-right" style={{ color: "var(--color-cream)" }}>{Math.round(s.entry.med)} mm</dd>
                  </>
                )}
                {s.entry.left !== undefined && (
                  <>
                    <dt style={{ color: "var(--color-muted)" }}>Mangler</dt>
                    <dd className="text-right" style={{ color: "var(--color-cream)" }}>{s.entry.left}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{s.kind === "other" ? "Bot eller gjest: ingen statistikk." : "Ingen tall for denne siden."}</p>
            )}
          </div>
        ))}
      </div>
      {archived ? (
        <Link href={`/kamp/${encodeURIComponent(m.id)}`} className={`glossy block text-center rounded-xl font-semibold ${FOCUS_RING}`} style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "2.75rem", lineHeight: "2.75rem" } as React.CSSProperties}>
          Se alle tall om kampen ›
        </Link>
      ) : (
        <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>Hele kampen ble ikke lagret for denne, så det er bare tallene over. Kamper fra nå av kan åpnes helt.</p>
      )}
    </div>
  );
}

/** Every match on record, ten to a page: tap one for its card, and from there to the whole match as the winner screen showed it. */
export function MatchLogTab() {
  const roster = useRoster();
  const log = useMemo(() => buildMatchLog(roster), [roster]);
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listArchivedIds().then((ids) => {
      if (!cancelled) setArchived(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (log.length === 0) {
    return (
      <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
        Ingen kamper ennå
      </p>
    );
  }
  const pages = Math.ceil(log.length / PAGE_SIZE);
  const current = Math.min(page, pages - 1);
  const rows = log.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <p className="section-label mb-2">{log.length} {log.length === 1 ? "KAMP" : "KAMPER"}</p>
      <div className="space-y-2">
        {rows.map((m) => {
          const isOpen = open === m.id;
          return (
            <div key={m.id} className="shadow-panel rounded-xl overflow-hidden" style={{ background: "var(--color-surface)" }}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.id)} className={`w-full text-left px-4 py-3 flex items-center gap-3 ${FOCUS_RING}`} style={{ minHeight: "3.75rem" }}>
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{m.sides.map((s) => s.name).join(" mot ")}</span>
                  <span className="block tabular" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{when(m.date)}</span>
                </span>
                <span className="shrink-0 text-right" style={{ color: m.winner ? "var(--color-gold-strong)" : "var(--color-muted)", fontSize: "0.8rem", fontWeight: 600, maxWidth: "8rem" }}>
                  <span className="block truncate">{m.winner ? `${m.winner} vant` : "Ukjent"}</span>
                </span>
                <span aria-hidden style={{ color: "var(--color-muted)", fontSize: "1.2rem", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>›</span>
              </button>
              {isOpen && <Card m={m} archived={archived.has(m.id)} />}
            </div>
          );
        })}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 mt-4">
          <button type="button" disabled={current === 0} onClick={() => { setPage(current - 1); setOpen(null); }} className={`tactile rounded-full px-5 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", opacity: current === 0 ? 0.4 : 1 }}>
            ‹ Nyere
          </button>
          <span className="tabular" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>Side {current + 1} av {pages}</span>
          <button type="button" disabled={current >= pages - 1} onClick={() => { setPage(current + 1); setOpen(null); }} className={`tactile rounded-full px-5 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", opacity: current >= pages - 1 ? 0.4 : 1 }}>
            Eldre ›
          </button>
        </div>
      )}
    </>
  );
}
