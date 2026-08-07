"use client";

import Link from "next/link";
import { useState } from "react";
import { STEPS, STEP_LABELS } from "@/lib/game";
import { averageDartsPerWin, averagePct, deletePlayer, useRoster } from "@/lib/storage";
import { TrashIcon } from "@/components/icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

export default function PlayersPage() {
  const roster = useRoster();
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  return (
    <div className="animate-screen-enter min-h-screen w-full p-4" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 pt-2">
          <Link href="/" className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}>
            ← Hjem
          </Link>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.4rem" }}>
            Spillere
          </h1>
          <div style={{ width: "72px" }} />
        </div>

        {roster.length === 0 && (
          <p className="text-center py-10" style={{ color: "var(--color-muted)" }}>
            Ingen spillere registrert enda
          </p>
        )}

        <div className="space-y-3">
          {roster.map((p) => (
            <div key={p.name} className="shadow-panel rounded-xl p-4" style={{ background: "var(--color-surface)" }}>
              {confirmingDelete === p.name ? (
                <div className="flex items-center flex-wrap gap-3 mb-3">
                  <p className="flex-1" style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>
                    Slette {p.name}? Statistikken forsvinner.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        deletePlayer(p.name);
                        setConfirmingDelete(null);
                      }}
                      className={`tactile px-3 py-2 rounded-lg text-sm font-medium ${FOCUS_RING}`}
                      style={{ background: "var(--color-red)", color: "var(--color-cream)" }}
                    >
                      Slett
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(null)}
                      className={`tactile px-3 py-2 rounded-lg text-sm font-medium ${FOCUS_RING}`}
                      style={{ background: "var(--color-green)", color: "var(--color-cream)" }}
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ background: "var(--color-cell)", border: "1px solid var(--color-border)" }}
                  >
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ color: "var(--color-muted)" }}>{p.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p style={{ color: "var(--color-cream)", fontWeight: 600 }}>{p.name}</p>
                    <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                      {p.matchesPlayed} {p.matchesPlayed === 1 ? "kamp" : "kamper"}
                    </p>
                  </div>
                  <div className="text-right tabular">
                    <p style={{ color: "var(--color-teal)", fontSize: "1.3rem", fontWeight: 700 }}>
                      {averagePct(p.overall)}%
                    </p>
                    <p style={{ color: "var(--color-muted)", fontSize: "0.65rem", letterSpacing: "0.1em" }}>TOTALT</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(p.name)}
                    aria-label={`Slett ${p.name}`}
                    className={`tactile w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${FOCUS_RING}`}
                    style={{ background: "var(--color-cell)", color: "var(--color-red)" }}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-5 gap-1">
                {STEPS.map((s) => (
                  <div
                    key={s}
                    className="rounded-md py-1.5 text-center tabular"
                    style={{
                      background: "var(--color-cell)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -4px 8px rgba(0,0,0,0.18)",
                    }}
                  >
                    <p style={{ color: "var(--color-muted)", fontSize: "0.6rem" }}>{STEP_LABELS[s]}</p>
                    <p style={{ color: "var(--color-cream)", fontSize: "0.75rem", fontWeight: 600 }}>
                      {averagePct(p.steps[s])}%
                    </p>
                  </div>
                ))}
              </div>
              <div
                className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <span style={{ color: "var(--color-muted)", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                  SNITT PILER PR RUNDE
                </span>
                <span className="tabular" style={{ color: "var(--color-teal)", fontWeight: 700 }}>
                  {averageDartsPerWin(p) ?? "–"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
