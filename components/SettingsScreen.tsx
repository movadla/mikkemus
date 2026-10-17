"use client";

import { FxPicker } from "./FxPicker";
import { KitSettings } from "./KitSettings";
import { QrCode } from "./QrCode";
import { ScreenTop } from "./ScreenTop";

/**
 * The settings, reached from the home screen: how much happens on screen and in the speakers
 * (this device's), and the teams' shirts (everyone's — they are on the team's record). The page
 * for trying out the sounds (/lyd) is a tool for whoever is tuning them and is reached by its
 * address, not from here.
 */
export function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Innstillinger" onBack={onBack} />
        <FxPicker />
        <KitSettings />

        {/* The big-screen page, one scan away: no address to type on the TV. */}
        <div className="mb-6 text-center">
          <p className="section-label mb-2">STORSKJERM</p>
          <div className="flex justify-center">
            <QrCode text={`${typeof window === "undefined" ? "" : window.location.origin}/storskjerm`} label="QR-kode til storskjermen" />
          </div>
          <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
            Skann med TV-en eller en annen skjerm. Sett den til Full party for effektene.
          </p>
        </div>
      </div>
    </div>
  );
}
