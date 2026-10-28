"use client";

import { useState } from "react";
import { cupColor } from "@/lib/botCup";
import { LADDER, dollars, isUnlocked, whyNot, type Career, type Place, type Tier } from "@/lib/career";
import { LockIcon } from "./careerIcons";
import { Button } from "./ui/Button";
import { CupEmblem } from "./ui/CupEmblem";
import { FOCUS_RING } from "./ui/focus";

const PLACE_NAME: Record<Place, string> = { winner: "Vinner", final: "Nr. 2", semi: "Semifinale", quarter: "Kvartfinale", r16: "Åttedelsfinale", r32: "Sekstendelsfinale" };

type State = "active" | "open" | "money" | "locked" | "busy";

function stateOf(career: Career, tier: Tier): State {
  if (career.active?.tier === tier.id) return "active";
  if (!isUnlocked(career, tier)) return "locked";
  const why = whyNot(career, tier);
  if (why === null) return "open";
  return career.active ? "busy" : "money";
}

/** The line under the name of a step on the road: where the player stands with it. */
function statusLine(career: Career, tier: Tier, state: State): string {
  if (state === "active") return career.active?.result ? "Ferdig spilt: hent premien" : "Pågår";
  if (state === "open") return tier.fee === 0 ? "Åpen · gratis" : `Åpen · inngang ${dollars(tier.fee)}${tier.qualify ? " · du er kvalifisert" : ""}`;
  if (state === "money") return `Du mangler ${dollars(tier.fee - career.money)} i inngang`;
  if (state === "busy") return "Etter turneringen som pågår";
  return tier.qualify ?? "Må kvalifiseres";
}

/**
 * The road from the pub to the world championship: the world championship at the top, the pub at the bottom, a node for each step. A step that
 * is open lights up in its own colour, one that is locked says what it takes, and the one that is going pulses. Tap a step to see what it pays
 * and to enter it. The player sees the whole way and where they stand on it.
 */
export function CareerRoad({ career, focus, onEnter, onContinue }: { career: Career; /** The step that is open from the start. */ focus: Tier["id"]; onEnter: (tier: Tier) => void; onContinue: () => void }) {
  const [openId, setOpenId] = useState<Tier["id"]>(focus);
  const steps = [...LADDER].reverse();
  return (
    <ol className="career-road" aria-label="Veien til VM">
      {steps.map((tier) => {
        const state = stateOf(career, tier);
        const colour = cupColor(tier.kind);
        const lit = state === "open" || state === "active";
        const open = openId === tier.id;
        return (
          <li key={tier.id} className="career-road-node" data-state={state}>
            <span className={`career-road-dot ${state === "active" ? "tab-pulse" : ""}`} style={{ borderColor: lit ? colour : "var(--color-border)", color: lit ? colour : "var(--color-muted)", boxShadow: lit ? `0 0 14px color-mix(in srgb, ${colour} 40%, transparent)` : "none" }} aria-hidden>
              {state === "locked" ? <LockIcon className="w-5 h-5" /> : <CupEmblem kind={tier.kind} className="w-6 h-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => setOpenId(open ? ("" as Tier["id"]) : tier.id)} aria-expanded={open} className={`tactile w-full text-left ${FOCUS_RING}`} style={{ padding: "0.55rem 0.8rem", borderRadius: "var(--radius-m)", background: open ? "var(--color-surface)" : "transparent", border: `1px solid ${open ? colour : "transparent"}`, boxShadow: "none" }}>
                <span className="block font-display" style={{ fontSize: "var(--text-title)", color: state === "locked" ? "var(--color-text-2)" : "var(--color-cream)" }}>
                  {tier.name}
                </span>
                <span className="block" style={{ fontSize: "var(--text-small)", color: state === "open" ? "var(--color-teal)" : state === "active" ? colour : "var(--color-muted)" }}>
                  {statusLine(career, tier, state)}
                </span>
              </button>
              {open && (
                <div className="mt-2 px-2 pb-2">
                  <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
                    {tier.venue} · {tier.size} spillere · ca. {tier.minutes} min
                  </p>
                  <ul className="flex flex-wrap gap-2 my-2" aria-label="Premier">
                    {(Object.keys(tier.prizes) as Place[]).map((p) => (
                      <li key={p} className="tabular" style={{ padding: "0.15rem 0.55rem", borderRadius: "var(--radius-pill)", background: "var(--gold-soft)", color: "var(--color-gold-strong)", border: "1px solid var(--color-gold)", fontSize: "var(--text-small)", fontWeight: 600 }}>
                        {PLACE_NAME[p]} {dollars(tier.prizes[p] ?? 0)}
                      </li>
                    ))}
                  </ul>
                  {state === "active" ? (
                    <Button block variant="primary" onClick={onContinue}>
                      {career.active?.result ? "Hent premien" : "Spill videre"}
                    </Button>
                  ) : state === "open" ? (
                    <Button block variant="primary" onClick={() => onEnter(tier)}>
                      Spill {tier.name} · {tier.fee === 0 ? "gratis" : dollars(tier.fee)}
                    </Button>
                  ) : (
                    <Button block disabled>
                      {state === "locked" ? tier.qualify : statusLine(career, tier, state)}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
