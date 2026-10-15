"use client";

import { FxPicker } from "./FxPicker";
import { KitSettings } from "./KitSettings";
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
      </div>
    </div>
  );
}
