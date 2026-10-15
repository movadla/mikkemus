"use client";

import Link from "next/link";
import { FxPicker } from "./FxPicker";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The settings of this device, reached from the home screen: how much happens on screen and in
 * the speakers, and — kept apart at the bottom, where it is out of the way — the page for trying
 * out the sounds, which is a tool for whoever is tuning them and not something to play with
 * before a match.
 */
export function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="animate-screen-enter min-h-screen w-full flex items-start justify-center px-6 pb-10" style={{ background: "var(--color-bg)", paddingTop: "3.5rem" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onBack}
            className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
          >
            ← Hjem
          </button>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.7rem", letterSpacing: "0.02em" }}>
            Innstillinger
          </h1>
          <span style={{ width: "72px" }} aria-hidden />
        </div>

        <FxPicker />

        <div className="mt-10">
          <p className="section-label text-center mb-3">UTVIKLER</p>
          <Link
            href="/lyd"
            className={`tactile flex items-center justify-between px-4 py-3 rounded-lg ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
          >
            <span>
              Lyder
              <span className="block" style={{ color: "var(--color-muted)", fontSize: "0.78rem" }}>
                Hør og juster lydene i spillet
              </span>
            </span>
            <span aria-hidden style={{ color: "var(--color-muted)" }}>
              ›
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
