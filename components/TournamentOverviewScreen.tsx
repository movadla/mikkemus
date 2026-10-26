"use client";

import { useState } from "react";
import { bracketRoundLabel, matchParticipants, podium, previewPlayoffBracket, standingsWithMovement, type Podium, type Tournament, type TournamentMatch } from "@/lib/tournament";
import { ConfirmDialog } from "./ConfirmDialog";
import { ScreenTop } from "./ScreenTop";
import { TrophyIcon } from "./icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/** Same columns in every table: place, name, played, won, lost, points. The two who just played
 *  are marked and show what the match gave them, so the table answers "what changed" without
 *  anyone comparing it to how it looked before. */
const TABLE_COLUMNS = "1.6rem minmax(0, 1fr) 1.8rem 1.8rem 1.8rem 2.6rem";

function MovementMark({ placesGained }: { placesGained: number | null }) {
  if (placesGained === null || placesGained === 0) return <span aria-hidden style={{ width: "1rem" }} />;
  const up = placesGained > 0;
  return (
    <span
      aria-label={up ? `opp ${placesGained} plasser` : `ned ${-placesGained} plasser`}
      style={{ color: up ? "var(--color-green)" : "var(--color-red)", fontSize: "var(--text-micro)", marginLeft: "0.5rem" }}
    >
      {up ? "▲" : "▼"}
      {Math.abs(placesGained)}
    </span>
  );
}

function StandingsTable({ names, matches, justPlayedId = null }: { names: string[]; matches: TournamentMatch[]; justPlayedId?: string | null }) {
  const rows = standingsWithMovement(names, matches, justPlayedId);
  return (
    <div role="table" aria-label="Tabell">
      <div role="row" className="section-label grid items-center px-4 pb-2" style={{ gridTemplateColumns: TABLE_COLUMNS, gap: "0.25rem" }}>
        <span role="columnheader">#</span>
        <span role="columnheader">NAVN</span>
        <span role="columnheader" className="text-center" title="Kamper">K</span>
        <span role="columnheader" className="text-center" title="Vunnet">V</span>
        <span role="columnheader" className="text-center" title="Tapt">T</span>
        <span role="columnheader" className="text-right" title="Poeng">P</span>
      </div>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div
            key={r.name}
            role="row"
            className="grid items-center px-4 rounded-lg"
            style={{
              gridTemplateColumns: TABLE_COLUMNS,
              gap: "0.25rem",
              minHeight: "var(--control)",
              background: "var(--color-surface)",
              border: r.inMatch ? "1px solid var(--color-teal)" : "1px solid transparent",
            }}
          >
            <span role="cell" className="tabular" style={{ color: i === 0 && r.played > 0 ? "var(--color-gold)" : "var(--color-muted)", fontSize: "var(--text-body)" }}>
              {i + 1}
            </span>
            <span role="cell" className="flex items-center min-w-0" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)" }}>
              <span className="truncate">{r.name}</span>
              <MovementMark placesGained={r.placesGained} />
            </span>
            <span role="cell" className="tabular text-center" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
              {r.played}
            </span>
            <span role="cell" className="tabular text-center" style={{ color: "var(--color-cream)", fontSize: "var(--text-small)" }}>
              {r.wins}
            </span>
            <span role="cell" className="tabular text-center" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
              {r.losses}
            </span>
            <span role="cell" className="tabular text-right" style={{ color: "var(--color-teal)", fontSize: "var(--text-body)", fontWeight: 700 }}>
              {r.points}
              {r.pointsGained > 0 && <span style={{ color: "var(--color-green)", fontSize: "var(--text-micro)", marginLeft: "0.25rem" }}>+{r.pointsGained}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** What the match that was just played ended as — shown above the table it changed. */
function JustPlayedCard({ match, tournament }: { match: TournamentMatch; tournament: Tournament }) {
  const participants = matchParticipants(match);
  const winner = match.winner;
  if (!winner || match.isBye) return null;
  const darts = (name: string) => match.stats?.[name]?.darts;
  const round = match.round === "group" ? `Gruppe ${(match.groupIndex ?? 0) + 1}` : bracketRoundLabel(match.bracketRoundSize ?? 1, match.isBronzeMatch);
  const group = match.round === "group" && match.groupIndex !== undefined ? tournament.groups[match.groupIndex] : null;
  return (
    <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-teal)" }}>
      <p className="section-label mb-2">RESULTAT · {round.toUpperCase()}</p>
      <p className="mb-4" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
        <span className="font-display" style={{ color: "var(--color-gold)", fontSize: "var(--text-title)" }}>
          {winner}
        </span>{" "}
        {participants.length === 2 ? <>vant over {participants.find((p) => p !== winner)}</> : <>vant · {match.placements?.join(" › ")}</>}
        {participants.every((p) => darts(p) !== undefined) && (
          <span className="tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
            {" "}
            · {participants.map((p) => darts(p)).join("–")} piler
          </span>
        )}
      </p>
      {group && <StandingsTable names={group} matches={tournament.matches.filter((m) => m.groupIndex === match.groupIndex)} justPlayedId={match.id} />}
    </div>
  );
}

function MatchRow({ match }: { match: TournamentMatch }) {
  const done = !!match.winner;
  const participants = matchParticipants(match);
  const darts = participants.map((p) => match.stats?.[p]?.darts);
  const showDarts = done && !match.isBye && darts.every((d) => d !== undefined);
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 rounded-lg" style={{ background: "var(--color-surface)", minHeight: "var(--control)" }}>
      <span style={{ color: "var(--color-cream)", fontSize: "var(--text-small)" }}>
        {participants.map((p, i) => (
          <span key={p}>
            {i > 0 && " vs "}
            <span style={{ color: p === match.winner ? "var(--color-gold)" : undefined }}>{p}</span>
          </span>
        ))}
      </span>
      {done && (
        <span className="tabular text-right shrink-0" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
          {/* A pod with more than 2 players shows the full finishing order, since "vant" alone
              wouldn't say who came 2nd/3rd; a normal 1-vs-1 match keeps today's plain wording. A
              bye never actually played, so it gets its own wording instead of reading as a win. */}
          {match.isBye
            ? "walkover videre"
            : participants.length > 2 && match.placements
              ? match.placements.join(" › ")
              : `${match.winner} vant`}
          {showDarts && <span className="block">{darts.join(" – ")} piler</span>}
        </span>
      )}
    </div>
  );
}

/** A group's matches in two lists: what is still to play, and what has been played with its result. */
function GroupMatches({ matches }: { matches: TournamentMatch[] }) {
  const upcoming = matches.filter((m) => !m.winner);
  const played = matches.filter((m) => !!m.winner);
  return (
    <>
      {upcoming.length > 0 && (
        <>
          <p className="section-label mt-4 mb-2">NESTE</p>
          <div className="space-y-2">
            {upcoming.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        </>
      )}
      {played.length > 0 && (
        <>
          <p className="section-label mt-4 mb-2">SPILT</p>
          <div className="space-y-2">
            {played.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** First, second and third of a finished tournament — the winner at the centre and tallest. */
function PodiumCard({ podium, trophy }: { podium: Podium; trophy?: string }) {
  const places: { name: string | null; place: number; height: string }[] = [
    { name: podium.second, place: 2, height: "5.2rem" },
    { name: podium.first, place: 1, height: "6.8rem" },
    { name: podium.third, place: 3, height: "4.2rem" },
  ];
  return (
    <div className="mb-6" role="list" aria-label="Pallen">
      <p className="mb-2 section-label text-center">TURNERINGEN ER FERDIG</p>
      {trophy && podium.first && (
        <p className="mb-3 text-center" style={{ color: "var(--color-gold)", fontWeight: 600 }}>
          {trophy} går til {podium.first}
        </p>
      )}
      <div className="flex items-end justify-center gap-2">
        {places.map(({ name, place, height }) => (
          <div key={place} role="listitem" className="flex-1 min-w-0 flex flex-col items-center gap-2">
            {place === 1 && <TrophyIcon className="w-6 h-6" />}
            <p className="font-display truncate w-full text-center" style={{ color: place === 1 ? "var(--color-gold)" : "var(--color-cream)", fontSize: place === 1 ? "var(--text-title)" : "var(--text-body)" }}>
              {name ?? "–"}
            </p>
            <div
              className={`w-full rounded-t-lg flex items-start justify-center pt-2 ${place === 1 ? "card-gold" : ""}`}
              style={{
                height,
                background: place === 1 ? undefined : "var(--color-surface)",
                border: place === 1 ? undefined : "1px solid var(--color-border)",
                borderBottom: "none",
              }}
            >
              <span className="font-display" style={{ fontSize: "var(--text-num)", color: place === 1 ? "var(--color-bg)" : "var(--color-muted)" }}>
                {place}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TournamentOverviewScreen({
  tournament,
  onPlayNext,
  onExitToHome,
  onCancelTournament,
  onNewWithSame,
  cancelingTournament = false,
  justPlayedId = null,
}: {
  tournament: Tournament;
  /** After a finished tournament: set up another with the same people. */
  onNewWithSame: () => void;
  /** The match that was just finished, if this screen is being shown straight after one — it is
   *  summarised above everything else, with the table it changed. */
  justPlayedId?: string | null;
  onPlayNext: (match: TournamentMatch) => void;
  onExitToHome: () => void;
  onCancelTournament: () => void;
  /** True while a previous "Ja, avbryt turneringen" tap is still deleting — the dialog stays open
   *  through that wait, so the button must guard itself against a second tap firing again. */
  cancelingTournament?: boolean;
}) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const finished = podium(tournament);
  const justPlayed = justPlayedId ? tournament.matches.find((m) => m.id === justPlayedId && m.winner) ?? null : null;
  const nextMatch = tournament.matches.find((m) => !m.winner && matchParticipants(m).length >= 2) ?? null;
  const bracketMatches = tournament.matches.filter((m) => m.round === "bracket");
  const bracketRoundSizes = Array.from(new Set(bracketMatches.map((m) => m.bracketRoundSize!))).sort((a, b) => b - a);

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      {showCancelConfirm && (
        <ConfirmDialog
          message="Avbryte turneringen? Fremgangen slettes permanent og kan ikke gjenopprettes."
          buttons={[
            { label: "Nei, fortsett turneringen", onClick: () => setShowCancelConfirm(false), background: "var(--color-green)" },
            {
              label: cancelingTournament ? "Avbryter …" : "Ja, avbryt turneringen",
              onClick: cancelingTournament ? () => {} : onCancelTournament,
              background: "var(--color-red)",
            },
          ]}
        />
      )}
      <div className="screen-inner">
        <ScreenTop title={tournament.cup?.name ?? "Turnering"} onBack={onExitToHome} />

        {tournament.cup && !finished && (
          <p className="mb-4 text-center" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
            Dere spiller om {tournament.cup.trophy}
          </p>
        )}

        {finished && (
          <>
            <PodiumCard podium={finished} trophy={tournament.cup?.trophy} />
            <button
              type="button"
              onClick={onNewWithSame}
              className={`glossy w-full py-4 rounded-xl font-semibold text-lg mb-6 ${FOCUS_RING}`}
              style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)" } as React.CSSProperties}
            >
              {tournament.cup ? "Ny pokalturnering med de samme" : "Ny turnering med samme deltakere"}
            </button>
          </>
        )}

        {justPlayed && <JustPlayedCard match={justPlayed} tournament={tournament} />}

        {nextMatch && tournament.status !== "done" && (
          <button
            type="button"
            onClick={() => onPlayNext(nextMatch)}
            className={`glossy w-full rounded-xl font-semibold text-lg mb-4 ${FOCUS_RING}`}
            style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control-lg)" } as React.CSSProperties}
          >
            Neste kamp: {matchParticipants(nextMatch).join(" vs ")}
          </button>
        )}

        <div className="space-y-4 mb-4">
          {tournament.groups.map((group, gi) => (
            <div key={gi} className="shadow-panel rounded-xl p-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
              <p className="section-label mb-2">GRUPPE {gi + 1}</p>
              {/* The group that has just played has its table in the result card above; showing it
                  again right under would only be the same numbers twice. */}
              {justPlayed?.round === "group" && justPlayed.groupIndex === gi ? (
                <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Tabellen står i resultatkortet over.</p>
              ) : (
                <StandingsTable names={group} matches={tournament.matches.filter((m) => m.groupIndex === gi)} />
              )}
              <GroupMatches matches={tournament.matches.filter((m) => m.groupIndex === gi)} />
            </div>
          ))}
        </div>

        {bracketMatches.length === 0 &&
          tournament.groups.length > 1 &&
          (() => {
            const preview = previewPlayoffBracket(tournament.groups);
            if (!preview) return null;
            return (
              <>
                <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
                  <p className="section-label mb-2">
                    SLUTTSPILL · {[bracketRoundLabel(preview.bracketSize / 2), ...preview.laterRoundLabels].join(" → ").toUpperCase()}
                    {preview.hasBronzeMatch && " · BRONSE"}
                  </p>
                  <div className="space-y-2">
                    {preview.matches.map((m, i) => (
                      <div key={i} className="flex items-center px-4 rounded-lg" style={{ background: "var(--color-surface)", minHeight: "var(--control)" }}>
                        <span style={{ color: "var(--color-cream)", fontSize: "var(--text-small)" }}>
                          {m.labelA}
                          {m.labelB ? ` vs ${m.labelB}` : " · walkover"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}

        {bracketMatches.length > 0 && (
          <>
            <div className="space-y-4 mb-4">
              {bracketRoundSizes.map((size) => (
                <div key={size} className="shadow-panel rounded-xl p-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
                  <p className="section-label mb-2">{bracketRoundLabel(size).toUpperCase()}</p>
                  <div className="space-y-2">
                    {bracketMatches
                      .filter((m) => m.bracketRoundSize === size && !m.isBronzeMatch)
                      .map((m) => (
                        <MatchRow key={m.id} match={m} />
                      ))}
                  </div>
                </div>
              ))}
              {bracketMatches.some((m) => m.isBronzeMatch) && (
                <div className="shadow-panel rounded-xl p-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
                  <p className="section-label mb-2">BRONSEFINALE</p>
                  <div className="space-y-2">
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

        {tournament.status !== "done" && (
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className={`tactile w-full rounded-lg text-sm ${FOCUS_RING}`}
            style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-red)", border: "1px solid var(--color-border)" }}
          >
            Avbryt turnering
          </button>
        )}
      </div>
    </div>
  );
}
