/**
 * The seeding as a medal: the number large in a round badge, and the rating beside it when it is known. The seeding is what decides who
 * meets whom, so it is drawn as something earned and not as grey text in front of a name.
 */
export function SeedBadge({ seed, rating, large = false }: { seed: number; rating?: number | null; large?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="sr-only">{`Seedet ${seed}${rating ? `, rating ${Math.round(rating)}` : ""}`}</span>
      <span className="seed-medal" style={{ width: large ? "2.5rem" : "1.75rem", height: large ? "2.5rem" : "1.75rem", fontSize: large ? "var(--text-title)" : "var(--text-small)" }} aria-hidden>
        {seed}
      </span>
      {rating ? (
        <span className="tabular" style={{ color: "var(--color-text-2)", fontSize: large ? "var(--text-body)" : "var(--text-micro)" }} aria-hidden>
          {Math.round(rating)}
        </span>
      ) : null}
    </span>
  );
}
