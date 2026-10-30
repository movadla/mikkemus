"use client";

import { useState } from "react";
import { dollars, type Career } from "@/lib/career";
import { LEDGER_SINCE, lastWeek, predatesBooks, totals } from "@/lib/ledger";
import { lifeOf } from "@/lib/careerLife";
import { Sheet } from "./ui/Sheet";
import { FOCUS_RING } from "./ui/focus";

const signed = (n: number) => `${n > 0 ? "+" : "−"}${dollars(Math.abs(n))}`;

/** The books of the career, from the money at the top: what came in and went out in the last week, and in all. */
export function MoneySheet({ career, onClose }: { career: Career; onClose: () => void }) {
  const [tab, setTab] = useState<"week" | "all">("week");
  const week = lifeOf(career).week;
  const entries = lastWeek(career);
  const sum = entries.reduce((s, e) => s + e.amount, 0);
  const all = totals(career);
  return (
    <Sheet title={`Regnskap · saldo ${dollars(career.money)}`} onClose={onClose}>
      <div className="pf-tabs mb-3" role="tablist" aria-label="Regnskap">
        {(
          [
            ["week", "Siste uke"],
            ["all", "Totalt"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`pf-tab tactile ${FOCUS_RING}`}>
            {label}
          </button>
        ))}
      </div>
      {/* A career from before the books: what it earned and spent before them is not here, and the sheet says since when it is. */}
      {predatesBooks(career) && (
        <p className="mb-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
          Føres fra {LEDGER_SINCE}.
        </p>
      )}
      {tab === "week" ? (
        <div role="tabpanel" aria-label="Siste uke">
          {entries.length === 0 ? (
            <p style={{ color: "var(--color-muted)" }}>Ingen bevegelser i uke {week - 1} eller {week}.</p>
          ) : (
            <>
              <ul className="books" aria-label="Bevegelser">
                {entries.map((e, i) => (
                  <li key={i}>
                    <span className="min-w-0">
                      <b className="block truncate">{e.label}</b>
                      <small>Uke {e.week}</small>
                    </span>
                    <span className={`tabular ${e.amount > 0 ? "books-in" : "books-out"}`}>{signed(e.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="books-sum">
                <span>Sum</span>
                <b className={`tabular ${sum >= 0 ? "books-in" : "books-out"}`}>{signed(sum)}</b>
              </p>
            </>
          )}
        </div>
      ) : (
        <div role="tabpanel" aria-label="Totalt">
          {all.byKind.length === 0 ? (
            <p style={{ color: "var(--color-muted)" }}>Regnskapet er tomt ennå.</p>
          ) : (
            <>
              <ul className="books" aria-label="Fordelt">
                {all.byKind.map((k) => (
                  <li key={k.kind}>
                    <b>{k.name}</b>
                    <span className={`tabular ${k.amount > 0 ? "books-in" : "books-out"}`}>{signed(k.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="books-sum">
                <span>Inn</span>
                <b className="tabular books-in">{signed(all.income)}</b>
              </p>
              <p className="books-sum">
                <span>Ut</span>
                <b className="tabular books-out">{signed(-all.spent)}</b>
              </p>
              <p className="books-sum">
                <span>Resultat</span>
                <b className={`tabular ${all.income - all.spent >= 0 ? "books-in" : "books-out"}`}>{signed(all.income - all.spent)}</b>
              </p>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
