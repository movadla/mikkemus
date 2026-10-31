"use client";

import { useState } from "react";
import { useAccess } from "@/lib/access";
import { eventTier, type ActiveEvent, type Career } from "@/lib/career";
import { frontOf } from "@/lib/show";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

/** The button after a tournament that opens the front page of the paper, with a headline and a lede made from the result. Only with the show. */
export function NewspaperButton({ career, a }: { career: Career; a: ActiveEvent }) {
  const { show } = useAccess();
  const [open, setOpen] = useState(false);
  const r = a.result;
  if (!show || !r) return null;
  const front = frontOf(career, eventTier(a).name, r.place, r.prize, r.points);
  return (
    <>
      <Button block onClick={() => setOpen(true)}>
        Les avisen
      </Button>
      {open && (
        <Sheet title={front.paper} onClose={() => setOpen(false)}>
          <article className="paper" aria-label={`Forside: ${front.headline}`}>
            <div className="paper-mast">{front.paper}</div>
            <div className="paper-meta">
              <span>{front.dateLine}</span>
              <span>Ekstrautgave</span>
            </div>
            <h3>{front.headline}</h3>
            <p>{front.lede}</p>
          </article>
        </Sheet>
      )}
    </>
  );
}
