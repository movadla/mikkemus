"use client";

import { FxPicker } from "./FxPicker";
import { SpotifyControl } from "./SpotifyControl";
import { useShowOdds, setShowOdds } from "@/lib/oddsSetting";
import { useAccess } from "@/lib/access";
import { QrCode } from "./QrCode";
import { ScreenTop } from "./ScreenTop";

/**
 * The settings, reached from the home screen: how much happens on screen and in the speakers
 * (this device's). The teams' shirts and walk-on tunes are on each team's own page (Spillere). The page
 * for trying out the sounds (/lyd) is a tool for whoever is tuning them and is reached by its
 * address, not from here.
 */
export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { limited } = useAccess();
  const showOdds = useShowOdds();
  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Innstillinger" onBack={onBack} />
        <FxPicker />
        <SpotifyControl />
        <div className="mb-6">
          <p className="section-label text-center mb-2">ODDS · VISES IKKE I VANLIG</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Odds">
            {([true, false] as const).map((on) => (
              <button
                key={String(on)}
                type="button"
                role="radio"
                aria-checked={showOdds === on}
                onClick={() => setShowOdds(on)}
                className="tactile flex-1 rounded-lg font-medium"
                style={{ minHeight: "2.75rem", background: showOdds === on ? "var(--teal-soft)" : "var(--color-surface)", color: showOdds === on ? "var(--color-teal)" : "var(--color-muted)", border: showOdds === on ? "1px solid var(--color-teal)" : "1px solid var(--color-border)", fontSize: "0.9rem" }}
              >
                {on ? "Vis odds" : "Skjul odds"}
              </button>
            ))}
          </div>
        </div>

        {/* The big-screen page, one scan away: no address to type on the TV. */}
        {!limited && (
        <div className="mb-6 text-center">
          <p className="section-label mb-2">STORSKJERM</p>
          <div className="flex justify-center">
            <QrCode text={`${typeof window === "undefined" ? "" : window.location.origin}/storskjerm`} label="QR-kode til storskjermen" />
          </div>
          <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
            Skann med TV-en eller en annen skjerm. Sett den til Full party for effektene.
          </p>
          <p className="section-label mt-5 mb-2">TURNERINGSBRAKETT PÅ STORSKJERM</p>
          <div className="flex justify-center">
            <QrCode text={`${typeof window === "undefined" ? "" : window.location.origin}/storskjerm/turnering`} label="QR-kode til turneringsbraketten på storskjermen" />
          </div>
          <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
            Viser braketten til den siste turneringen og følger den fra resultat til resultat.
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
