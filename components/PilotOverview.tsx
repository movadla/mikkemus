"use client";

import { useState } from "react";
import { cupColor } from "@/lib/botCup";
import { seedOf } from "@/lib/knockout";
import { hasForcedRings } from "@/lib/rules";
import { currentStage, nextPilotMatch, pilotPlayers, pilotQueue, pilotSlotLabel, pilotStages, routesOf, slotShort, undoablePilotMatch } from "@/lib/pilot";
import { useRoster } from "@/lib/storage";
import { tournamentTitle, type Tournament, type TournamentMatch } from "@/lib/tournament";
import { ConfirmDialog } from "./ConfirmDialog";
import { CupLine } from "./CupLine";
import { MatchPoster, PosterGrid, type PosterSide } from "./MatchPoster";
import { ScreenTop } from "./ScreenTop";
import { Avatar } from "./ui/Avatar";
import { StageStrip } from "./StageStrip";
import { Button } from "./ui/Button";

const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";
const card = { background: "var(--color-panel)", border: "1px solid var(--color-border)" } as const;

/** Where the places of a match lead, in words: what the first two and the last two of a match of four get. */
export function routingOf(m: TournamentMatch): string {
  switch (m.pilot?.stage) {
    case "heat":
      return "1.–2. går til vinnerbane, 3.–4. til taperbane";
    case "winners":
      return "1.–2. går rett til kvartfinale, 3.–4. til lucky loser";
    case "losers":
      return "1.–2. går til lucky loser, 3.–4. er ute";
    case "lucky":
      return "Vinneren går til kvartfinale, taperen er ute";
    case "quarter":
      return "Vinneren går til semifinale";
    case "semi":
      return "Vinneren går til finalen";
    default:
      return "Vinneren er mester";
  }
}

/** The sides of a match as the posters draw them: face, seeding and, for a bot, its level. */
export function sidesOf(t: Tournament, m: TournamentMatch, photos: Map<string, string | null | undefined>): PosterSide[] {
  return pilotPlayers(m).map((name) => {
    const entrant = t.participants.find((p) => p.name === name);
    return { name, photo: photos.get(name), bot: !!entrant?.isBot, level: entrant?.botLevel, seed: seedOf(t, name) };
  });
}

/** What a match that is over ended as: the places, and where each went. */
function ResultCard({ match }: { match: TournamentMatch }) {
  const places = match.placements ?? [];
  return (
    <div className="card mb-4" style={{ ...card, border: "1px solid var(--color-teal)" }}>
      <p className="section-label mb-3">RESULTAT · {match.pilot?.label.toUpperCase()}</p>
      <ol className="space-y-1 mb-3">
        {places.map((name, i) => (
          <li key={name} className="flex items-baseline gap-3" style={{ color: i === 0 ? "var(--color-gold-strong)" : i < 2 || places.length === 2 ? "var(--color-cream)" : "var(--color-muted)" }}>
            <span className="font-display tabular" style={{ minWidth: "1.5rem" }}>
              {i + 1}.
            </span>
            <span className="font-display truncate" style={{ fontSize: i === 0 ? "var(--text-title)" : "var(--text-body)" }}>
              {name}
            </span>
          </li>
        ))}
      </ol>
      <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>{routingOf(match)}.</p>
    </div>
  );
}

/** The match to play next as a poster: who and in what order, the stage, the forced rings when they apply, and the ones that follow. */
function NextCard({ tournament, match, queue, photos, onPlay }: { tournament: Tournament; match: TournamentMatch; queue: TournamentMatch[]; photos: Map<string, string | null | undefined>; onPlay: () => void }) {
  const sides = sidesOf(tournament, match, photos);
  const forced = hasForcedRings(match.variant);
  const routes = routesOf(match.pilot?.stage);
  return (
    <div className="card mb-4" style={{ ...card, border: "1px solid var(--color-teal)" }}>
      <p className="section-label mb-3 text-center">NESTE · {match.pilot?.label.toUpperCase()}</p>
      <div className="mb-3">{sides.length === 2 ? <MatchPoster a={sides[0]} b={sides[1]} tint={cupColor(tournament.cup?.kind)} /> : <PosterGrid sides={sides} />}</div>
      {sides.length === 4 && routes && (
        <ul className="mb-3 flex flex-wrap items-center justify-center gap-2" aria-label="Veien videre">
          {routes.map((rt) => (
            <li key={rt.places} className="route-chip" data-tone={rt.tone}>
              {rt.places} <span>{rt.to}</span>
            </li>
          ))}
        </ul>
      )}
      {forced && (
        <p className="mb-3 text-center" style={{ color: "var(--color-gold-strong)", fontSize: "var(--text-small)", fontWeight: 600 }}>
          Tvungne ringer: dobbel og trippel gjelder bare på 20 til 14. Kampen teller ikke i personlig statistikk.
        </p>
      )}
      <button
        type="button"
        onClick={onPlay}
        className={`glossy w-full rounded-xl font-semibold text-lg ${FOCUS_RING}`}
        style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control-lg)" } as React.CSSProperties}
      >
        Start kampen
      </button>
      {queue.length > 0 && (
        <div className="mt-4">
          <p className="section-label mb-2">DERETTER</p>
          <ol className="space-y-1">
            {queue.slice(0, 4).map((m, i) => (
              <li key={m.id} className="flex items-center gap-2" style={{ fontSize: "var(--text-body)", color: "var(--color-cream)" }}>
                <span className="tabular shrink-0 text-center" style={{ width: "1.25rem", color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate">{m.pilot?.label}</span>
                <span className="shrink-0 truncate" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)", maxWidth: "55%" }}>
                  {pilotPlayers(m).join(", ")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** One match in the course: its players (or what fills the places still empty), and the places once it is over. */
export function MatchBox({ tournament, match, next }: { tournament: Tournament; match: TournamentMatch; next: boolean }) {
  const photos = new Map(useRoster().map((r) => [r.name, r.photo]));
  const players = pilotPlayers(match);
  const slots = match.pilot?.slots;
  const rows = match.placements ?? players;
  const four = (slots?.length ?? 4) === 4;
  const expected = slots?.length ?? 4;
  const routes = four ? routesOf(match.pilot?.stage) : null;
  // The lanes are a grid of places (two by two), the heats a list in the order they throw.
  const grid = four && (match.pilot?.stage === "winners" || match.pilot?.stage === "losers");
  // The lane has its own colour: winners in the everyday accent, losers in bronze, the lucky losers in gold, the rest in the cup's.
  const lane = match.pilot?.stage === "winners" ? "var(--color-teal)" : match.pilot?.stage === "losers" ? "var(--color-bronze)" : match.pilot?.stage === "lucky" ? "var(--color-gold)" : cupColor(tournament.cup?.kind);
  return (
    <li className="lane-box" data-next={next || undefined} style={{ "--lane": lane } as React.CSSProperties}>
      <p className="flex items-baseline justify-between gap-2 mb-2" style={{ color: "var(--color-cream)", fontWeight: 600, fontSize: "var(--text-body)" }}>
        <span>{match.pilot?.label}</span>
        {next && (
          <span className="rounded-full px-2" style={{ background: "var(--color-teal)", color: "var(--color-bg)", fontSize: "var(--text-micro)", letterSpacing: "0.1em", fontWeight: 700 }}>
            NESTE
          </span>
        )}
        {match.simulated && (
          <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", letterSpacing: "0.08em" }}>AUTO</span>
        )}
      </p>
      <ol className={grid ? "grid grid-cols-2 gap-x-2 gap-y-1.5" : "space-y-1.5"}>
        {Array.from({ length: expected }, (_, i) => {
          const name = players.length === expected ? rows[i] : undefined;
          const tone = routes ? routes[i < 2 ? 0 : 1].tone : undefined;
          if (!name) {
            // A place nobody holds yet: a round shadow and what fills it. In the lane grid it is the short mark («A1»).
            const label = pilotSlotLabel(tournament, match, i);
            return grid ? (
              <li key={i} className="flex items-center gap-1.5 min-w-0 route-row" data-tone={tone} style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                <span aria-hidden className="lane-ghost lane-ghost-label">
                  {slotShort(label)}
                </span>
                <span className="sr-only">{label}</span>
              </li>
            ) : (
              <li key={i} className="flex items-center gap-2 route-row" data-tone={tone} style={{ color: "var(--color-muted)", fontStyle: "italic", fontSize: "var(--text-small)" }}>
                <span aria-hidden className="lane-ghost" />
                {label}
              </li>
            );
          }
          const through = !!match.winner && (i === 0 || (four && i < 2));
          return (
            <li key={name} className="flex items-center gap-2 min-w-0 route-row" data-tone={tone} style={{ fontSize: "var(--text-small)", color: match.winner ? (i === 0 ? "var(--color-gold-strong)" : through ? "var(--color-cream)" : "var(--color-muted)") : "var(--color-cream)", opacity: match.winner && !through ? 0.7 : 1 }}>
              <Avatar name={name} photo={photos.get(name)} size="xs" bot={tournament.participants.find((x) => x.name === name)?.isBot} />
              <span className="truncate flex-1">
                {match.placements ? `${i + 1}. ` : ""}
                {name}
                {!grid && seedOf(tournament, name) && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}> ({seedOf(tournament, name)})</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </li>
  );
}

/**
 * Ly Pilotturnering between matches: the result of the match that was just played and where its places lead, the card for the next
 * match with the ones that follow, and the whole course from the heats to the final with every place filled as it is decided.
 */
export function PilotOverview({
  tournament,
  justDecidedId,
  decidedElsewhere,
  onPlayNext,
  onExitToHome,
  onUndo,
  onCancelTournament,
  cancelingTournament,
  onHistory,
}: {
  tournament: Tournament;
  justDecidedId: string | null;
  /** Matches of bots only, which the model decided since the last one was thrown. */
  decidedElsewhere: string[];
  onPlayNext: (match: TournamentMatch) => void;
  onExitToHome: () => void;
  onUndo: () => void;
  onCancelTournament: () => void;
  cancelingTournament: boolean;
  onHistory?: () => void;
}) {
  const roster = useRoster();
  const photos = new Map(roster.map((r) => [r.name, r.photo]));
  const [confirm, setConfirm] = useState<"cancel" | "undo" | null>(null);
  const next = nextPilotMatch(tournament);
  const queue = pilotQueue(tournament, next);
  const just = justDecidedId ? tournament.matches.find((m) => m.id === justDecidedId && m.winner) ?? null : null;
  const elsewhere = decidedElsewhere.map((id) => tournament.matches.find((m) => m.id === id)).filter((m): m is TournamentMatch => !!m && !!m.winner);
  const undoable = undoablePilotMatch(tournament);
  const stage = currentStage(tournament);
  return (
    <div className="animate-screen-push screen cup-lamp" style={{ "--cup": cupColor(tournament.cup?.kind) } as React.CSSProperties}>
      {confirm === "cancel" && (
        <ConfirmDialog
          message="Slette turneringen?"
          buttons={[
            { label: "Behold", onClick: () => setConfirm(null), background: "var(--color-green)" },
            { label: cancelingTournament ? "Sletter …" : "Slett", onClick: cancelingTournament ? () => {} : onCancelTournament, background: "var(--color-red)" },
          ]}
        />
      )}
      {confirm === "undo" && undoable && (
        <ConfirmDialog
          message={`Angre ${undoable.pilot?.label}?`}
          buttons={[
            { label: "Behold", onClick: () => setConfirm(null), background: "var(--color-green)" },
            { label: "Angre", onClick: () => { setConfirm(null); onUndo(); }, background: "var(--color-red)" },
          ]}
        />
      )}
      <div className="screen-inner" style={{ maxWidth: "min(100%, 64rem)" }}>
        <ScreenTop title={tournamentTitle(tournament)} sub={tournament.cup ? <CupLine cup={tournament.cup} /> : undefined} onBack={onExitToHome} right={onHistory ? <Button onClick={onHistory}>Pokaler</Button> : undefined} />
        <StageStrip tournament={tournament} />
        <div className="mx-auto" style={{ maxWidth: "28rem" }}>
          {just && <ResultCard match={just} />}
          {elsewhere.length > 0 && (
            <div className="card mb-4" style={card}>
              <p className="section-label mb-2">ANDRE KAMPER</p>
              <ul className="space-y-1">
                {elsewhere.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3" style={{ fontSize: "var(--text-body)" }}>
                    <span className="truncate" style={{ color: "var(--color-cream)" }}>
                      <span style={{ color: "var(--color-gold-strong)", fontWeight: 600 }}>{m.winner}</span> vant {m.pilot?.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {next && <NextCard key={next.id} tournament={tournament} match={next} queue={queue} photos={photos} onPlay={() => onPlayNext(next)} />}
        </div>

        <div className="space-y-6 mb-6">
          {pilotStages(tournament).map((s) => (
            <section key={s.stage} aria-label={s.title}>
              <h2 className="section-label mb-2" style={{ color: s.stage === stage ? "var(--color-teal)" : undefined }}>
                {s.title.toUpperCase()}
              </h2>
              <ul className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}>
                {s.matches.map((m) => (
                  <MatchBox key={m.id} tournament={tournament} match={m} next={m.id === next?.id} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mx-auto space-y-2" style={{ maxWidth: "28rem" }}>
          {undoable && (
            <Button block onClick={() => setConfirm("undo")}>
              Angre siste resultat
            </Button>
          )}
          <Button block variant="danger" onClick={() => setConfirm("cancel")}>
            Slett turnering
          </Button>
        </div>
      </div>
    </div>
  );
}
