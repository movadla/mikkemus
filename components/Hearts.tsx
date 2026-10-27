import { HeartIcon } from "./icons";

/** A row of hearts: the lives there are, the ones that are gone as outlines, and the one that was lost just now breaking. */
export function Hearts({ total, left, fresh, size = "w-5 h-5" }: { total: number; left: number; fresh: boolean; size?: string }) {
  return (
    <span className="inline-flex flex-wrap gap-0.5" role="img" aria-label={`${left} av ${total} liv igjen`}>
      {Array.from({ length: total }, (_, i) => {
        const alive = i < left;
        const justLost = fresh && i === left;
        return (
          <span key={i} className={`heart ${alive ? "" : "heart--lost"} ${justLost ? "heart--fresh" : ""}`}>
            <HeartIcon className={size} filled={alive || justLost} />
          </span>
        );
      })}
    </span>
  );
}
