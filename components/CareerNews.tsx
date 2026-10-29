"use client";

import { useState } from "react";
import type { Career } from "@/lib/career";
import { lifeOf, weekInSeason, type NewsItem } from "@/lib/careerLife";
import { CharacterFace } from "./CharacterFigure";
import { NewsIcon } from "./careerIcons";
import { Avatar } from "./ui/Avatar";
import { FOCUS_RING } from "./ui/focus";

/** The face by a story: the player's own character, the person it is about, or the paper's mark when it is about no one. */
function Face({ career, who }: { career: Career; who?: string }) {
  if (!who) {
    return (
      <span className="feed-mark" aria-hidden>
        <NewsIcon className="w-5 h-5" />
      </span>
    );
  }
  return who === career.player ? <CharacterFace id={career.profile.character} px={40} /> : <Avatar name={who} bot px={40} />;
}

/** The news of the career: a headline for each, newest first, a week at a time. A tap opens the story under it. */
export function CareerNews({ career }: { career: Career }) {
  const life = lifeOf(career);
  const [open, setOpen] = useState<string | null>(null);
  const unseen = (n: NewsItem) => Number(n.id.slice(1)) > life.newsSeen;
  // Items come newest first, so a heading goes in where the week changes.
  const rows: ({ head: string } | NewsItem)[] = [];
  let last = -1;
  for (const n of life.news) {
    if (n.week !== last)
      rows.push({
        head: `Uke ${weekInSeason(n.week)}`,
      });
    last = n.week;
    rows.push(n);
  }
  if (rows.length === 0) return <p style={{ color: "var(--color-muted)" }}>Ingen nyheter ennå. Spill en turnering, så skjer det noe.</p>;
  return (
    <>
      <p className="section-label feed-title">HENDELSER</p>
      <ol className="feed" aria-label="Nyheter">
        {rows.map((r, i) =>
          "head" in r ? (
            <li key={`h-${i}`} className="feed-head section-label">
              {r.head}
            </li>
          ) : (
            <li key={r.id} className={`feed-item ${unseen(r) ? "feed-new" : ""}`}>
              <button type="button" className={`feed-row tactile ${FOCUS_RING}`} aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <Face career={career} who={r.who} />
                <b className="min-w-0 text-left">{r.headline}</b>
              </button>
              {open === r.id && <p className="feed-text">{r.text}</p>}
            </li>
          ),
        )}
      </ol>
    </>
  );
}
