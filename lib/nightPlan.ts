/**
 * Kveldsplan: the matches of an evening set up in advance. A planned match is a game and the setup of that game exactly as the game's own setup
 * screen holds it (the games own the shape of their setup: see PlanLink), with a line of text for the list. It is played from the plan with
 * «Neste»: the game opens with the setup filled in and goes straight to the question of who starts. The match that comes of it carries the id of
 * the planned match (`planned`), which is how the plan knows it is played.
 */
import { useEffect, useRef } from "react";
import type { BonusSettings } from "./bonus";
import type { Evening, NightMatch } from "./nightScore";
import type { PickedTeam, Person } from "./people";

export type PlanGame = "enkeltkamp" | "countdown" | "highstriker" | "lava" | "halvit" | "killer";

export const PLAN_GAMES: { id: PlanGame; name: string }[] = [
  { id: "enkeltkamp", name: "Enkeltkamp" },
  { id: "countdown", name: "301 / 501" },
  { id: "highstriker", name: "Highstriker" },
  { id: "lava", name: "Lava" },
  { id: "halvit", name: "Halv It" },
  { id: "killer", name: "Killer" },
];

export const planGameName = (g: PlanGame): string => PLAN_GAMES.find((p) => p.id === g)?.name ?? g;

export type PlannedMatch = {
  id: string;
  game: PlanGame;
  /** What the setup screen of the game holds (people or teams, lives, best of, ...). Only the game itself reads it. */
  setup: unknown;
  /** Who plays: «Vadla og Hans mot Monge og Erlend». */
  who: string;
  /** The rest of the setup in a line: «2 lag · 501». */
  label: string;
};

/** What a game gets from the plan when it is opened from it: the setup to start from, and what to do with the setup screen. */
export type PlanLink = {
  setup?: unknown;
  /** The setup screen is for the plan: its button puts the setup in the plan instead of starting the match. */
  planning: boolean;
  /** The match starts by itself with the setup (once): from «Neste». */
  autostart: boolean;
  onPlan: (setup: unknown, label: string) => void;
};

/** What the setup of the games holds, all of it optional: each game writes the parts it has and reads them back. */
export type PlanSetup = {
  mode?: "individual" | "team";
  people?: Person[];
  teams?: PickedTeam[];
  advanced?: boolean;
  bestOf?: number;
  lives?: number;
  rings?: boolean;
  both?: boolean;
  start?: 301 | 501;
  bonus?: BonusSettings;
  doubleOut?: boolean;
};

/** Who plays in a setup: the teams or the players, as the games all name them. */
export function whoOf(setup: unknown): string {
  const s = setup as { mode?: string; people?: { name: string }[]; teams?: { name: string }[] } | undefined;
  const names = (s?.mode === "team" ? s.teams : s?.people)?.map((x) => x.name) ?? [];
  return names.length === 2 ? `${names[0]} mot ${names[1]}` : names.join(", ");
}

/** A planned match that has been played: a match of the evening that is not taken out has its id. */
export const isPlayed = (p: PlannedMatch, matches: NightMatch[]): boolean => matches.some((m) => m.planned === p.id && !m.deleted);

/** The next one to play: the first in the plan that has not been. */
export const nextPlanned = (evening: Evening | null, matches: NightMatch[]): PlannedMatch | null => evening?.plan?.find((p) => !isPlayed(p, matches)) ?? null;

export const moved = <T,>(list: T[], from: number, by: number): T[] => {
  const to = from + by;
  if (to < 0 || to >= list.length || from < 0 || from >= list.length) return list;
  const out = [...list];
  out.splice(to, 0, ...out.splice(from, 1));
  return out;
};

/** The plan session: what the game is opened for (to add a match to the plan, to change one, or to play it). Kept for the page that is opened. */
export type PlanSession = { kind: "add" | "edit" | "play"; eveningId: string; game: PlanGame; plannedId?: string; setup?: unknown };

const KEY = "mikke-mus-plan-session";
let current: PlanSession | null = null;

export function setPlanSession(s: PlanSession | null): void {
  current = s;
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Kept in memory only.
  }
}

export function getPlanSession(): PlanSession | null {
  if (current) return current;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) current = JSON.parse(raw) as PlanSession;
  } catch {
    // None.
  }
  return current;
}

/** The planned match that is being played now: the matches written meanwhile belong to it. */
export const activePlanned = (): string | null => (current?.kind === "play" ? (current.plannedId ?? null) : null);

/** Runs `start` once, as soon as the setup is ready: for a game that was opened from «Neste». */
export function useAutostart(on: boolean | undefined, ready: boolean, start: () => void): void {
  const done = useRef(false);
  useEffect(() => {
    if (!on || !ready || done.current) return;
    done.current = true;
    start();
  });
}
