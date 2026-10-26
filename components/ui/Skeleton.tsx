/** Placeholder rows while a list loads: the shape of what is coming, so the page does not jump when it arrives. */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Henter">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: "var(--control-lg)", borderRadius: "var(--radius-m)" }} />
      ))}
    </div>
  );
}
