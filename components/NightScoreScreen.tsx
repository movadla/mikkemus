"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccess } from "@/lib/access";
import { dayLabel, timeLabel } from "@/lib/formatDate";
import { useGameResults } from "@/lib/gameResultsStorage";
import { buildMatchLog } from "@/lib/matchLog";
import { groupNights, nightOf } from "@/lib/nights";
import {
  NIGHT_GAME_MARKS,
  bonusText,
  NIGHT_GAME_NAMES,
  isOverridden,
  lineOf,
  matchesOf,
  placementsFor,
  pointsOf,
  resultOf,
  sideLabel,
  tableOf,
  type NightGame,
  type NightMatch,
  type NightSide,
} from "@/lib/nightScore";
import { currentEvening, deleteEvening, recordNightMatch, refreshNight, startNewEvening, updateNightMatch, useNightScore, type NewNightMatch } from "@/lib/nightScoreStorage";
import type { PickedTeam, Person } from "@/lib/people";
import { useRoster } from "@/lib/storage";
import { ConfirmDialog } from "./ConfirmDialog";
import { GameWho, type GameMode } from "./GameWho";
import { PlusIcon } from "./icons";
import { ScreenTop } from "./ScreenTop";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { FOCUS_RING } from "./ui/focus";
import { Segmented } from "./ui/Segmented";
import { Sheet } from "./ui/Sheet";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** The matches of tonight that the records and the other games have, and Kveldsscore does not (for a first evening that began after some of them). */
function useSuggestions(matches: NightMatch[]): NewNightMatch[] {
  const roster = useRoster();
  const results = useGameResults();
  return useMemo(() => {
    const tonight = nightOf(new Date().toISOString());
    const have = new Set(matches.flatMap((m) => [m.id, m.source?.id ?? ""]));
    const out: NewNightMatch[] = [];
    for (const row of buildMatchLog(roster)) {
      if (nightOf(row.date) !== tonight || have.has(row.id) || !row.winner || row.sides.some((s) => s.kind === "other")) continue;
      out.push({ id: row.id, at: row.date, game: "enkeltkamp", sides: row.sides.map((s) => ({ name: s.name, members: s.members ?? [s.name] })), placements: [row.winner, ...row.sides.map((s) => s.name).filter((n) => n !== row.winner)], source: { kind: "match", id: row.id } });
    }
    for (const r of results) {
      if (nightOf(r.playedAt) !== tonight || have.has(r.id) || r.bots.length > 0) continue;
      out.push({ id: r.id, at: r.playedAt, game: r.game as NightGame, sides: r.players.map((name) => ({ name, members: [name] })), placements: [r.winner, ...r.players.filter((p) => p !== r.winner)], source: { kind: "game", id: r.id } });
    }
    return out.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  }, [roster, results, matches]);
}

/** Kveldsscore: the points of the evening in a table, and its matches as one line each. */
export function NightScoreScreen() {
  const night = useNightScore();
  const { limited } = useAccess();
  const roster = useRoster();
  const evenings = useMemo(() => [...night.evenings].sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [night.evenings]);
  const current = currentEvening(night);
  const [chosen, setChosen] = useState<string | null>(null);
  const evening = evenings.find((e) => e.id === chosen) ?? current;
  const isCurrent = !!evening && evening.id === current?.id;
  const matches = useMemo(() => (evening ? matchesOf(night.matches, evening.id) : []), [night.matches, evening]);
  const live = matches.filter((m) => !m.deleted);
  const rows = useMemo(() => tableOf(matches), [matches]);
  const [tab, setTab] = useState<"tabell" | "kamper">("tabell");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rules, setRules] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);
  const suggestions = useSuggestions(night.matches);
  const photos = new Map(roster.map((r) => [r.name, r.photo]));
  const openMatch = matches.find((m) => m.id === open) ?? null;
  const history = !limited && evening && groupNights(roster).some((n) => n.date === nightOf(evening.startedAt)) ? `/kveld/${nightOf(evening.startedAt)}` : null;

  // The Angre of a deletion stays for a few seconds.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  const index = evening ? evenings.findIndex((e) => e.id === evening.id) : -1;
  const step = (d: number) => {
    const next = evenings[index + d];
    if (next) setChosen(next.id);
  };

  return (
    <div className="animate-screen-push screen">
      <div className="screen-inner">
        <ScreenTop
          title="Kveldsscore"
          backHref="/mer"
          sub={evening ? `${dayLabel(evening.startedAt)} · fra ${timeLabel(evening.startedAt)}` : undefined}
          right={
            isCurrent && live.length > 0 ? (
              <button type="button" onClick={() => setConfirmNew(true)} className={`tactile px-3 rounded-lg ${FOCUS_RING}`} style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "var(--text-small)", fontWeight: 700 }}>
                Ny kveld
              </button>
            ) : undefined
          }
        />
        {confirmNew && (
          <ConfirmDialog
            message="Starte en ny kveld? Kampene så langt blir liggende på denne kvelden."
            buttons={[
              { label: "Behold denne", onClick: () => setConfirmNew(false), background: "var(--color-green)" },
              {
                label: "Ny kveld",
                onClick: () => {
                  setConfirmNew(false);
                  setChosen(null);
                  startNewEvening();
                },
                background: "var(--color-teal)",
                color: "var(--color-bg)",
              },
            ]}
          />
        )}

        {confirmDelete && evening && (
          <ConfirmDialog
            message={`Slette kvelden med ${live.length} ${live.length === 1 ? "kamp" : "kamper"}? Det kan ikke angres. Statistikken til spillerne blir som den er.`}
            buttons={[
              { label: "Behold", onClick: () => setConfirmDelete(false), background: "var(--color-green)" },
              {
                label: "Slett kvelden",
                onClick: () => {
                  setConfirmDelete(false);
                  setChosen(null);
                  deleteEvening(evening.id);
                },
                background: "var(--color-red)",
              },
            ]}
          />
        )}

        {evenings.length > 1 && evening && (
          <div className="kv-evenings" role="group" aria-label="Kveld">
            <button type="button" aria-label="Forrige kveld" disabled={index >= evenings.length - 1} onClick={() => step(1)} className={`tactile ${FOCUS_RING}`}>
              ‹
            </button>
            <span>{evenings.length - index > 0 ? `Kveld ${evenings.length - index} av ${evenings.length}` : ""}</span>
            <button type="button" aria-label="Neste kveld" disabled={index <= 0} onClick={() => step(-1)} className={`tactile ${FOCUS_RING}`}>
              ›
            </button>
          </div>
        )}

        {isCurrent && live.length === 0 && suggestions.length > 0 && (
          <div className="kv-suggest" role="region" aria-label="Kamper fra i kveld">
            <p>
              <b>{suggestions.length === 1 ? "1 kamp" : `${suggestions.length} kamper`}</b> er allerede spilt i kveld. Skal de være med?
            </p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => suggestions.forEach((s) => recordNightMatch(s))}>
                Legg til {suggestions.length === 1 ? "kampen" : "alle"}
              </Button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <Segmented
            value={tab}
            onChange={setTab}
            label="Kveldsscore"
            fit
            options={[
              { value: "tabell", label: "Tabell" },
              { value: "kamper", label: live.length > 0 ? `Kamper (${live.length})` : "Kamper" },
            ]}
          />
        </div>

        {!evening || matches.length === 0 ? (
          <EmptyState title="Ingen kamper i kveld ennå" hint="Kampene kommer inn av seg selv når de er ferdige, eller du kan legge dem inn for hånd." />
        ) : tab === "tabell" ? (
          <ol className="kv-table" aria-label="Tabell">
            {rows.map((r, i) => (
              <li key={r.name} className={`kv-row ${i === 0 && r.points > 0 ? "kv-row--first" : ""}`}>
                <span className="kv-rank">{i + 1}</span>
                <Avatar name={r.name} photo={photos.get(r.name)} px={36} />
                <span className="kv-name">{r.name}</span>
                <span className="kv-meta">
                  {r.matches} {r.matches === 1 ? "kamp" : "kamper"} · {r.wins}-{r.losses}
                  {r.bonus > 0 && ` · +${r.bonus} bonus`}
                </span>
                <span className="kv-points tabular" aria-label={`${r.points} poeng`}>
                  {r.points}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="kv-lines" aria-label="Kamper">
            {matches.map((m) => {
              const line = lineOf(m);
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => setOpen(m.id)} className={`kv-line tactile ${m.deleted ? "kv-line--deleted" : ""} ${FOCUS_RING}`}>
                    <span className="kv-game" aria-hidden>
                      {NIGHT_GAME_MARKS[m.game]}
                    </span>
                    <span className="kv-text">
                      <b>{line.title}</b>
                      <small>
                        {NIGHT_GAME_NAMES[m.game]} · {timeLabel(m.at)}
                        {m.manual && <span className="kv-tag">Manuell</span>}
                        {isOverridden(m) && !m.deleted && <span className="kv-tag kv-tag--o">Overstyrt</span>}
                        {m.deleted && <span className="kv-tag kv-tag--d">Slettet</span>}
                        {line.tag && !m.deleted && <span className="kv-tag">{line.tag}</span>}
                        {line.bonus && !m.deleted && <span className="kv-tag kv-tag--o">Bonus</span>}
                      </small>
                    </span>
                    {line.score && <span className="kv-score tabular">{line.score}</span>}
                    <span aria-hidden className="kv-chev">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {(isCurrent || !evening) && (
          <div className="mt-4">
            <Button block icon={<PlusIcon className="w-5 h-5" />} onClick={() => setAdding(true)}>
              Legg til en kamp
            </Button>
          </div>
        )}
        <div className="mt-3">
          <button type="button" onClick={() => void refreshNight(true)} className={`tactile flex items-center justify-center w-full rounded-lg mb-2 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", color: "var(--color-teal)", fontWeight: 700, fontSize: "var(--text-small)" }}>
            Oppdater fra de andre telefonene
          </button>
          <button type="button" onClick={() => setRules(true)} className={`tactile flex items-center justify-center w-full rounded-lg ${FOCUS_RING}`} style={{ minHeight: "var(--control)", color: "var(--color-teal)", fontWeight: 700, fontSize: "var(--text-small)" }}>
            Regler for Kveldsscore
          </button>
        </div>
        {history && (
          <div className="mt-3">
            <Link href={history} className={`tactile flex items-center justify-center rounded-lg ${FOCUS_RING}`} style={{ minHeight: "var(--control)", color: "var(--color-teal)", fontWeight: 700, fontSize: "var(--text-small)" }}>
              Kveldens historie
            </Link>
          </div>
        )}
      </div>

      {evening && (
        <div className="screen-inner mt-6">
          <button type="button" onClick={() => setConfirmDelete(true)} className={`tactile flex items-center justify-center w-full rounded-lg ${FOCUS_RING}`} style={{ minHeight: "var(--control)", color: "var(--color-red)", fontWeight: 700, fontSize: "var(--text-small)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            Slett kvelden
          </button>
        </div>
      )}
      {rules && <RulesSheet onClose={() => setRules(false)} />}
      {openMatch && (
        <MatchSheet
          m={openMatch}
          canOpen={!limited}
          onClose={() => setOpen(null)}
          onDelete={() => {
            updateNightMatch(openMatch.id, { deleted: true });
            setUndo(openMatch.id);
            setOpen(null);
          }}
        />
      )}
      {adding && <AddMatchSheet onClose={() => setAdding(false)} />}
      {undo && (
        <div className="kv-toast" role="status">
          <span>Kampen er slettet fra kvelden</span>
          <button
            type="button"
            onClick={() => {
              updateNightMatch(undo, { deleted: false });
              setUndo(null);
            }}
            className={FOCUS_RING}
          >
            Angre
          </button>
        </div>
      )}
    </div>
  );
}

const RULES: { title: string; text: string }[] = [
  { title: "Poeng", text: "Den som vinner en kamp mellom to får ett poeng. I lagspill får begge på laget ett poeng hver." },
  { title: "Tre eller flere", text: "Er det tre eller flere i en kamp, gir plassene 3, 2 og 1 poeng (først, nummer to og nummer tre). Resten får ingenting." },
  { title: "Uavgjort", text: "Er en kamp uavgjort, får ingen poeng." },
  { title: "Best av x", text: "Spilles det en serie (best av 3, 5 eller 7), er hele serien én kamp. Den som vinner flest spill først vinner serien og får poenget." },
  { title: "Ekstrapoeng", text: "Er ekstrapoeng slått på under Avanserte innstillinger, gir 180, tre i bull og utsjekk på 100 eller mer ett poeng mer til den som gjorde det, uansett hvem som vant." },
  { title: "Hvilke kamper", text: "Bare kamper der alle er mennesker teller. Kamper mot boter kommer ikke med." },
  { title: "Kvelden", text: "En kveld varer til du trykker «Ny kveld». Kampene kommer inn av seg selv når de er ferdige, i alle spill." },
  { title: "Rette og slette", text: "Du kan overstyre vinneren (eller velge uavgjort), legge inn en kamp for hånd og slette en kamp eller hele kvelden. Det rører ikke statistikken til spillerne." },
];

/** The rules of Kveldsscore: how the points are counted. */
function RulesSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Regler for Kveldsscore" onClose={onClose}>
      <dl className="space-y-3">
        {RULES.map((r) => (
          <div key={r.title}>
            <dt className="section-label mb-0.5">{r.title.toUpperCase()}</dt>
            <dd style={{ color: "var(--color-cream)", fontSize: "var(--text-body)", lineHeight: 1.45 }}>{r.text}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}

/** One match: who won (changed here), the way to the match itself, and taking it out of the evening. */
function MatchSheet({ m, canOpen, onClose, onDelete }: { m: NightMatch; /** The page of a match is not for the limited code. */ canOpen: boolean; onClose: () => void; onDelete: () => void }) {
  const order = resultOf(m);
  const line = lineOf(m);
  const value = order ? order[0] : "draw";
  const points = pointsOf(m);
  const giving = Object.entries(points).filter(([, p]) => p > 0);
  const link = canOpen && m.source?.kind === "match" ? `/kamp/${m.source.id}` : null;
  return (
    <Sheet title={line.title} onClose={onClose}>
      <p className="section-label mb-2">VINNER</p>
      <div className="mb-3">
        <Segmented
          value={value}
          onChange={(v) => {
            if (v === m.placements[0]) updateNightMatch(m.id, { override: undefined });
            else updateNightMatch(m.id, { override: v === "draw" ? { draw: true } : { placements: placementsFor(m, v) } });
          }}
          label="Vinner"
          options={[...m.sides.map((s: NightSide) => ({ value: s.name, label: sideLabel(s) })), { value: "draw", label: "Uavgjort" }]}
        />
      </div>
      {m.bonus && m.bonus.length > 0 && (
        <p className="mb-2" style={{ color: "var(--color-gold-strong)", fontSize: "var(--text-small)", fontWeight: 700 }}>
          Ekstrapoeng: {bonusText(m)}
        </p>
      )}
      <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }} aria-live="polite">
        {m.deleted ? "Kampen er tatt ut av kvelden, så den gir ingen poeng." : giving.length === 0 ? "Ingen får poeng." : giving.map(([p, n]) => `${p} får ${n === 1 ? "ett poeng" : `${n} poeng`}`).join(", ") + "."}
      </p>
      <div className="space-y-2">
        {link && (
          <Link href={link} className={`glossy flex items-center justify-center rounded-xl font-semibold ${FOCUS_RING}`} style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control-lg)" } as React.CSSProperties}>
            Åpne kampen
          </Link>
        )}
        {isOverridden(m) && (
          <Button block onClick={() => updateNightMatch(m.id, { override: undefined })}>
            Tilbakestill til det opprinnelige
          </Button>
        )}
        {m.deleted ? (
          <Button block onClick={() => updateNightMatch(m.id, { deleted: false })}>
            Legg tilbake i kvelden
          </Button>
        ) : (
          <Button block onClick={onDelete}>
            <span style={{ color: "var(--color-red)" }}>Slett fra kvelden</span>
          </Button>
        )}
      </div>
    </Sheet>
  );
}

const GAME_CHOICES: NightGame[] = ["enkeltkamp", "301", "501", "highstriker", "lava", "halvit", "killer", "bullduel", "annet"];

/** A match written in by hand: the game, who played (players or teams) and who won. */
function AddMatchSheet({ onClose }: { onClose: () => void }) {
  const [game, setGame] = useState<NightGame>("enkeltkamp");
  const [mode, setMode] = useState<GameMode>("individual");
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<PickedTeam[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const sides: NightSide[] = mode === "team" ? teams.map((t) => ({ name: t.name, members: t.members.map((m) => m.name) })) : people.map((p) => ({ name: p.name, members: [p.name] }));
  const chosen = winner && sides.some((s) => s.name === winner) ? winner : null;
  const ready = sides.length >= 2 && !!chosen;
  return (
    <Sheet title="Legg til en kamp" onClose={onClose}>
      <p className="section-label mb-2">SPILL</p>
      <div className="mb-4">
        <Segmented value={game} onChange={setGame} label="Spill" options={GAME_CHOICES.map((g) => ({ value: g, label: NIGHT_GAME_NAMES[g] }))} />
      </div>
      <GameWho mode={mode} onMode={setMode} people={people} onPeople={setPeople} teams={teams} onTeams={setTeams} guests={false} botsAllowed={false} />
      {sides.length >= 2 && (
        <>
          <p className="section-label mb-2">HVEM VANT</p>
          <div className="mb-4">
            <Segmented value={chosen ?? ""} onChange={setWinner} label="Hvem vant" options={sides.map((s) => ({ value: s.name, label: sideLabel(s) }))} />
          </div>
        </>
      )}
      <Button
        block
        variant="primary"
        size="lg"
        disabled={!ready}
        onClick={() => {
          if (!chosen) return;
          recordNightMatch({ id: newId(), game, sides, placements: placementsFor({ sides }, chosen), manual: true });
          onClose();
        }}
      >
        Legg til
      </Button>
    </Sheet>
  );
}
