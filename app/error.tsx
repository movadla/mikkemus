"use client";

import { useRouter } from "next/navigation";

/** What shows when a page fails while it is drawn, instead of a blank screen: nothing in the records is lost by it. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="screen">
      <div className="screen-inner text-center" style={{ paddingTop: "4rem" }}>
        <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "var(--text-num)" }}>
          Noe gikk galt
        </h1>
        <p className="mt-2 mb-6" style={{ color: "var(--color-muted)" }}>
          Siden kunne ikke vises. Statistikken er ikke berørt.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="glossy rounded-xl font-semibold"
            style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "var(--control)" } as React.CSSProperties}
          >
            Prøv igjen
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-xl"
            style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
          >
            Til forsiden
          </button>
        </div>
      </div>
    </div>
  );
}
