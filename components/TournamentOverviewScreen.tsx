"use client";

import { bracketRoundLabel, computeStandings, previewPlayoffBracket, type Tournament, type TournamentMatch } from "@/lib/tournament";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

function StandingsTable({ names, matches }: { names: string[]; matches: TournamentMatch[] }) {
  const rows = computeStandings(names, matches);
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={r.name} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: "var(--color-surface)" }}>
          <span style={{ color: "var(--color-cream)", fontSize: "0.85rem" }}>
            <span style={{ color: "var(--color-muted)", marginRight: "0.5rem" }}>{i + 1}.</span>
            {r.name}
          </span>
          <span className="tabular" style={{ color: "var(--color-teal)", fontSize: "0.8rem" }}>
            {r.wins}-{r.losses} · {r.points}p
          </span>
        </div>
      ))}
    </div>
  );
}

function MatchRow({ match }: { match: TournamentMatch }) {
  const done = !!match.winner;
  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: "var(--color-surface)", opacity: done ? 0.7 : 1 }}>
      <span style={{ color: "var(--color-cream)", fontSize: "0.85rem" }}>
        <span style={{ color: match.winner === match.participantA ? "var(--color-gold)" : undefined }}>{match.participantA ?? "—"}</span>
        {" vs "}
        <span style={{ color: match.winner === match.participantB ? "var(--color-gold)" : undefined }}>{match.participantB ?? "—"}</span>
      </span>
      {done && (
        <span className="tabular" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
          {match.winner} vant
        </span>
      )}
    </div>
  );
}

export function TournamentOverviewScreen({
  tournament,
  onPlayNext,
  onExitToHome,
}: {
  tournament: Tournament;
  onPlayNext: (match: TournamentMatch) => void;
  onExitToHome: () => void;
}) {
  const nextMatch = tournament.matches.find((m) => !m.winner && m.participantA && m.participantB) ?? null;
  const bracketMatches = tournament.matches.filter((m) => m.round === "bracket");
  const bracketRoundSizes = Array.from(new Set(bracketMatches.map((m) => m.bracketRoundSize!))).sort((a, b) => b - a);

  return (
    <div className="animate-screen-enter min-h-screen w-full p-4" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 pt-2">
          <button type="button" onClick={onExitToHome} className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`} style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}>
            ← Hjem
          </button>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.3rem" }}>
            Turnering
          </h1>
          <div style={{ width: "72px" }} />
        </div>

        {tournament.status === "done" && tournament.winner && (
          <div className="shadow-panel rounded-xl p-5 mb-6 text-center" style={{ background: "linear-gradient(135deg, var(--color-gold), #a9812f)" }}>
            <p className="font-display" style={{ color: "var(--color-bg)", fontStyle: "italic", fontSize: "0.9rem" }}>
              Turneringsvinner
            </p>
            <p className="font-display" style={{ color: "var(--color-bg)", fontSize: "1.6rem" }}>
              🏆 {tournament.winner}
            </p>
          </div>
        )}

        {nextMatch && tournament.status !== "done" && (
          <button
            type="button"
            onClick={() => onPlayNext(nextMatch)}
            className={`tactile w-full py-4 rounded-lg font-semibold text-lg mb-6 ${FOCUS_RING}`}
            style={{ background: "var(--color-green)", color: "var(--color-cream)" }}
          >
            Spill: {nextMatch.participantA} vs {nextMatch.participantB}
          </button>
        )}

        <p className="mb-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
          GRUPPER
        </p>
        <div className="space-y-4 mb-6">
          {tournament.groups.map((group, gi) => (
            <div key={gi} className="shadow-panel rounded-xl p-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
              <p className="mb-2" style={{ color: "var(--color-muted)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>
                GRUPPE {gi + 1}
              </p>
              <StandingsTable names={group} matches={tournament.matches.filter((m) => m.groupIndex === gi)} />
              <p className="mt-3 mb-1.5" style={{ color: "var(--color-muted)", fontSize: "0.65rem", letterSpacing: "0.1em" }}>
                KAMPER
              </p>
              <div className="space-y-1.5">
                {tournament.matches
                  .filter((m) => m.groupIndex === gi)
                  .map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
              </div>
            </div>
          ))}
        </div>

        {bracketMatches.length === 0 && tournament.groups.length <= 1 && (
          <p className="text-center mb-6" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
            Ingen sluttspill — vinneren av gruppa blir turneringsvinner.
          </p>
        )}

        {bracketMatches.length === 0 &&
          tournament.groups.length > 1 &&
          (() => {
            const preview = previewPlayoffBracket(tournament.groups);
            if (!preview) return null;
            return (
              <>
                <p className="mb-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
                  SLUTTSPILL (FORHÅNDSVISNING)
                </p>
                <div className="shadow-panel rounded-xl p-3 mb-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
                  <p className="mb-2" style={{ color: "var(--color-muted)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>
                    {bracketRoundLabel(preview.bracketSize / 2).toUpperCase()}
                  </p>
                  <div className="space-y-1.5">
                    {preview.matches.map((m, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: "var(--color-surface)" }}>
                        <span style={{ color: "var(--color-cream)", fontSize: "0.85rem" }}>
                          {m.labelA}
                          {m.labelB ? ` vs ${m.labelB}` : " (walkover videre)"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-center mb-6" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
                  {preview.laterRoundLabels.length > 0 && <>Deretter: {preview.laterRoundLabels.join(" → ")}. </>}
                  {preview.hasBronzeMatch && "Det spilles også bronsefinale. "}
                  {preview.byes > 0 && `${preview.byes} får walkover i første runde. `}
                  Endelig oppsett avgjøres av gruppetabellene.
                </p>
              </>
            );
          })()}

        {bracketMatches.length > 0 && (
          <>
            <p className="mb-2" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
              SLUTTSPILL
            </p>
            <div className="space-y-4 mb-6">
              {bracketRoundSizes.map((size) => (
                <div key={size} className="shadow-panel rounded-xl p-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
                  <p className="mb-2" style={{ color: "var(--color-muted)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>
                    {bracketRoundLabel(size).toUpperCase()}
                  </p>
                  <div className="space-y-1.5">
                    {bracketMatches
                      .filter((m) => m.bracketRoundSize === size && !m.isBronzeMatch)
                      .map((m) => (
                        <MatchRow key={m.id} match={m} />
                      ))}
                  </div>
                </div>
              ))}
              {bracketMatches.some((m) => m.isBronzeMatch) && (
                <div className="shadow-panel rounded-xl p-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
                  <p className="mb-2" style={{ color: "var(--color-muted)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>
                    BRONSEFINALE
                  </p>
                  <div className="space-y-1.5">
                    {bracketMatches
                      .filter((m) => m.isBronzeMatch)
                      .map((m) => (
                        <MatchRow key={m.id} match={m} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
