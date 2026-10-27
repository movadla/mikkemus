/** The way out as darts in colour: treble in teal, double in red, the bull in gold, a single plain. */
export function CheckoutChips({ way }: { way: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1" role="img" aria-label={`Ut: ${way.join(" ")}`}>
      {way.map((d, i) => {
        const kind = d === "Bull" ? "b" : d.startsWith("T") ? "t" : d.startsWith("D") ? "d" : "s";
        return (
          <span key={`${i}-${d}`} className={`dart-chip dart-chip--${kind}`} style={{ animationDelay: `${i * 120}ms` }} aria-hidden>
            {d}
          </span>
        );
      })}
    </span>
  );
}

const DART_WORDS = ["", "EN PIL", "TO PILER", "TRE PILER"];

/** «UT PÅ TRE PILER»: the label over the chips. */
export const checkoutLabel = (darts: number) => `UT PÅ ${DART_WORDS[darts] ?? ""}`;
