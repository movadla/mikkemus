"use client";

import type { Career } from "@/lib/career";
import { lifeOf, seasonOf, weekInSeason, WEEKS_PER_SEASON, type NewsItem } from "@/lib/careerLife";
import { CharacterFace } from "./CharacterFigure";
import { NewsIcon } from "./careerIcons";
import { Avatar } from "./ui/Avatar";

const KIND: Record<NewsItem["kind"], string> = { cup: "Turnering", upset: "Skrell", you: "Deg", season: "Sesong", world: "Verden" };

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

/** The news of the career: what the others did while the player played, newest first, a week at a time. */
export function CareerNews({ career }: { career: Career }) {
  const life = lifeOf(career);
  const unseen = (n: NewsItem) => Number(n.id.slice(1)) > life.newsSeen;
  // Items come newest first, so a heading goes in where the week changes.
  const rows: ({ head: string } | NewsItem)[] = [];
  let last = -1;
  for (const n of life.news) {
    if (n.week !== last) rows.push({ head: `Sesong ${seasonOf(n.week)} · uke ${weekInSeason(n.week)} av ${WEEKS_PER_SEASON}` });
    last = n.week;
    rows.push(n);
  }
  if (rows.length === 0) return <p style={{ color: "var(--color-muted)" }}>Ingen nyheter ennå. Spill en turnering, så skjer det noe.</p>;
  return (
    <ol className="feed" aria-label="Nyheter">
      {rows.map((r, i) =>
        "head" in r ? (
          <li key={`h-${i}`} className="feed-head section-label">
            {r.head}
          </li>
        ) : (
          <li key={r.id} className={`feed-item ${unseen(r) ? "feed-new" : ""}`}>
            <Face career={career} who={r.who} />
            <span className="min-w-0">
              <small className="feed-kind">{KIND[r.kind]}</small>
              <b className="block">{r.headline}</b>
              <span className="feed-text">{r.text}</span>
            </span>
          </li>
        ),
      )}
    </ol>
  );
}
