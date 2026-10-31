"use client";

import { useMemo } from "react";
import { comparisonOf, type NightMatch } from "@/lib/nightScore";

/**
 * Players against each other over the evening: a grid where a row is read as «how this one did against that one» (wins–losses), and
 * below it how pairs did when they were on the same side.
 */
export function NightCompare({ matches }: { matches: NightMatch[] }) {
  const { players, against, together } = useMemo(() => comparisonOf(matches), [matches]);
  if (players.length < 2) return null;
  return (
    <div className="space-y-5">
      <section>
        <h2 className="section-label mb-2">MOT HVERANDRE</h2>
        <p className="mb-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
          Raden mot kolonnen: seiere–tap når de var på hvert sitt lag.
        </p>
        <div className="kv-gridwrap">
          <table className="kv-grid" aria-label="Mot hverandre">
            <thead>
              <tr>
                <td />
                {players.map((p) => (
                  <th key={p} scope="col">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((a) => (
                <tr key={a}>
                  <th scope="row">{a}</th>
                  {players.map((b) => {
                    const d = against[a]?.[b];
                    if (a === b) return <td key={b} className="kv-grid-self">–</td>;
                    if (!d) return <td key={b} className="kv-grid-none">·</td>;
                    return (
                      <td key={b} className={d.won > d.lost ? "kv-grid-up" : d.won < d.lost ? "kv-grid-down" : ""}>
                        {d.won}–{d.lost}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {together.length > 0 && (
        <section>
          <h2 className="section-label mb-2">SAMMEN</h2>
          <ul className="kv-lines" aria-label="Sammen">
            {together.map((t) => (
              <li key={t.pair.join("|")}>
                <div className="kv-line kv-line--pair">
                  <span className="kv-text">
                    <b>{t.pair.join("/")}</b>
                  </span>
                  <span className="kv-score tabular">
                    {t.won}–{t.lost}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
