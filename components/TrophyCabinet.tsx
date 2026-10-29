"use client";

import { LADDER, type Career } from "@/lib/career";
import { LockIcon } from "./careerIcons";
import { TrophyArt } from "./CareerTrophy";

/**
 * The cups of the career on three shelves: the ones that are won, in their metal, with how many times and when the last one was, and the ones
 * that are still to win as dark outlines with a lock. The cups won in invitations (a name of their own) stand on the lowest shelf.
 */
const MYSTERY_TOTAL = 7;
const MYSTERY_KINDS = ["vm", "gs", "nm", "region", "lu", "gs", "vm"] as const;

export function TrophyCabinet({ career }: { career: Career }) {
  const slots = LADDER.map((t) => {
    const won = career.trophies.filter((x) => x.tier === t.id && !x.name);
    return { tier: t, n: won.length, last: won[0]?.at.slice(0, 10) };
  });
  const named = new Map<string, { tier: (typeof LADDER)[number]["id"]; n: number }>();
  for (const x of career.trophies) {
    if (!x.name) continue;
    const have = named.get(x.name);
    named.set(x.name, { tier: x.tier, n: (have?.n ?? 0) + 1 });
  }
  // Cups of invitations are not known before the invitations come: the places that are still to fill stand as dark outlines with a question mark.
  const hidden = Math.max(0, MYSTERY_TOTAL - named.size);
  const shelves = [slots.slice(0, 3), slots.slice(3)];
  const have = slots.filter((s) => s.n > 0).length + named.size;
  const total = slots.length + named.size;
  const mystery = (i: number) => (
    <div key={`?${i}`} className="cabinet-slot cabinet-slot-empty" data-mystery>
      <span className="t3d-locked block">
        <TrophyArt kind={MYSTERY_KINDS[i % MYSTERY_KINDS.length]} bare />
      </span>
      <span className="cabinet-lock cabinet-q" aria-hidden>?</span>
      <small>Ukjent</small>
      <small className="cabinet-note">Venter på invitasjon</small>
    </div>
  );
  return (
    <div className="cabinet" role="group" aria-label={`Pokalskapet: ${have} av ${total}`}>
      {shelves.map((row, i) => (
        <div key={i} className="cabinet-shelf">
          {row.map(({ tier, n, last }) => (
            <div key={tier.id} className={`cabinet-slot ${n > 0 ? "" : "cabinet-slot-empty"}`}>
              {n > 0 ? (
                <TrophyArt kind={tier.id} bare />
              ) : (
                <>
                  <span className="t3d-locked block">
                    <TrophyArt kind={tier.id} bare />
                  </span>
                  <LockIcon className="cabinet-lock" />
                </>
              )}
              <small>{tier.trophy.replace(/-pokalen$/, "").replace(/pokalen$/, "")}</small>
              <small className="cabinet-note">{n > 0 ? `${n > 1 ? `×${n} · ` : ""}${last}` : "Ikke vunnet"}</small>
            </div>
          ))}
          {i === 1 && hidden > 0 && mystery(0)}
        </div>
      ))}
      {(named.size > 0 || hidden > 1) && (
        <div className="cabinet-shelf cabinet-shelf-wrap">
          {[...named].map(([name, { tier, n }]) => (
            <div key={name} className="cabinet-slot">
              <TrophyArt kind={tier} bare variant={name} />
              <small>{name.replace(/-pokalen$/, "")}</small>
              <small className="cabinet-note">{n > 1 ? `×${n}` : "Vunnet"}</small>
            </div>
          ))}
          {Array.from({ length: Math.max(0, hidden - 1) }, (_, i) => mystery(i + 1))}
        </div>
      )}
    </div>
  );
}
