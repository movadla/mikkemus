"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Evening, NightMatch } from "@/lib/nightScore";
import { PLAN_GAMES, isPlayed, nextPlanned, planGameName, setPlanSession, type PlanGame, type PlanSession, type PlanSetup, type PlannedMatch } from "@/lib/nightPlan";
import { movePlanned, removePlanned } from "@/lib/nightScoreStorage";
import { PlusIcon } from "./icons";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { FOCUS_RING } from "./ui/focus";
import { Sheet } from "./ui/Sheet";

/** The short mark on a line of the plan: the game. */
const markOf = (p: PlannedMatch): string => {
  if (p.game === "countdown") return String((p.setup as PlanSetup | undefined)?.start ?? 501);
  return { enkeltkamp: "1v1", countdown: "501", highstriker: "HS", lava: "LAVA", halvit: "½", killer: "KILL" }[p.game];
};

/** Kveldsplan: the matches of the evening set up in advance. «Neste» plays the first that is not played; every match can be changed, moved or taken out. */
export function NightPlanView({ evening, matches }: { evening: Evening; matches: NightMatch[] }) {
  const router = useRouter();
  const plan = evening.plan ?? [];
  const next = nextPlanned(evening, matches);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const item = plan.find((p) => p.id === open) ?? null;

  // The game opens with what the plan asked for: the page that holds the games reads it from the plan session.
  const go = (kind: PlanSession["kind"], game: PlanGame, p?: PlannedMatch) => {
    setPlanSession({ kind, eveningId: evening.id, game, plannedId: p?.id, setup: p?.setup });
    router.push("/?plan=1");
  };

  return (
    <div>
      {next ? (
        <div className="mb-3">
          <Button variant="primary" size="lg" block onClick={() => go("play", next.game, next)}>
            Neste: {planGameName(next.game)}
            {next.who ? ` · ${next.who}` : ""}
          </Button>
        </div>
      ) : plan.length > 0 ? (
        <p className="mb-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
          Alle kampene i planen er spilt. Legg til flere under, eller se tabellen.
        </p>
      ) : null}

      {plan.length === 0 ? (
        <EmptyState title="Ingen kamper i planen ennå" hint="Legg til kampene i kveld, med innstillingene de skal spilles med. Så trykker du bare Neste." />
      ) : (
        <ul className="kv-lines" aria-label="Kveldsplan">
          {plan.map((p) => {
            const played = isPlayed(p, matches);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => setOpen(p.id)} className={`kv-line tactile ${played ? "kv-line--played" : ""} ${FOCUS_RING}`}>
                  <span className="kv-game" aria-hidden>
                    {markOf(p)}
                  </span>
                  <span className="kv-text">
                    <b>{p.who || planGameName(p.game)}</b>
                    <small>
                      {planGameName(p.game)}
                      {p.label ? ` · ${p.label}` : ""}
                      {played && <span className="kv-tag">Spilt</span>}
                      {!played && next?.id === p.id && <span className="kv-tag kv-tag--o">Neste</span>}
                    </small>
                  </span>
                  <span aria-hidden className="kv-chev">
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        <Button block icon={<PlusIcon className="w-5 h-5" />} onClick={() => setAdding(true)}>
          Legg til kamp i planen
        </Button>
      </div>

      {adding && (
        <Sheet title="Hvilket spill?" onClose={() => setAdding(false)}>
          <div className="space-y-2">
            {PLAN_GAMES.map((g) => (
              <Button key={g.id} block onClick={() => go("add", g.id)}>
                {g.name}
              </Button>
            ))}
          </div>
        </Sheet>
      )}

      {item && (
        <Sheet title={item.who || planGameName(item.game)} onClose={() => setOpen(null)}>
          <p className="mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            {planGameName(item.game)}
            {item.label ? ` · ${item.label}` : ""}
            {isPlayed(item, matches) ? ". Kampen er spilt. Endrer du oppsettet her, endres bare planen, ikke resultatet." : ""}
          </p>
          <div className="space-y-2">
            <Button
              block
              variant="primary"
              onClick={() => {
                setOpen(null);
                go("edit", item.game, item);
              }}
            >
              Endre oppsettet
            </Button>
            <Button block disabled={plan.indexOf(item) === 0} onClick={() => movePlanned(evening.id, item.id, -1)}>
              Flytt opp
            </Button>
            <Button block disabled={plan.indexOf(item) === plan.length - 1} onClick={() => movePlanned(evening.id, item.id, 1)}>
              Flytt ned
            </Button>
            <Button
              block
              onClick={() => {
                removePlanned(evening.id, item.id);
                setOpen(null);
              }}
            >
              <span style={{ color: "var(--color-red)" }}>Slett fra planen</span>
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
