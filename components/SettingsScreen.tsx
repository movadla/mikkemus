"use client";

import { useState } from "react";
import { FX_LABELS, FX_LEVELS, setFxLevel, useFxLevel } from "@/lib/fxLevel";
import { useShowOdds, setShowOdds } from "@/lib/oddsSetting";
import { setTexture, useTexture } from "@/lib/texture";
import { setTheme, useTheme } from "@/lib/theme";
import { setUiSound, useUiSound } from "@/lib/uiSound";
import { useAccess } from "@/lib/access";
import { QrCode } from "./QrCode";
import { ScreenTop } from "./ScreenTop";
import { SpotifyControl } from "./SpotifyControl";
import { ChevronRightIcon, MoonIcon, SunIcon, TvIcon } from "./icons";
import { Section } from "./ui/Section";
import { Segmented } from "./ui/Segmented";
import { Sheet } from "./ui/Sheet";
import { SwitchRow } from "./ui/Switch";
import { FOCUS_RING } from "./ui/focus";

/** A row that opens something: the name, and a chevron. */
function LinkRow({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tactile w-full flex items-center gap-3 px-4 text-left ${FOCUS_RING}`}
      style={{ minHeight: "var(--control-lg)", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)", fontSize: "var(--text-body)", fontWeight: 600 }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <ChevronRightIcon className="w-4 h-4" />
    </button>
  );
}

/**
 * The settings: how the screens look and sound on this device, in groups, each setting a row with its own control. What is
 * for the big screen is a QR code a tap away, not on the page. The teams' shirts and walk-on tunes are on each team's own
 * page (Spillere).
 */
export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const { limited } = useAccess();
  const showOdds = useShowOdds();
  const texture = useTexture();
  const uiSoundOn = useUiSound();
  const theme = useTheme();
  const fx = useFxLevel();
  const [qr, setQr] = useState<"live" | "turnering" | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="animate-screen-push screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Innstillinger" onBack={onBack} backHref={onBack ? undefined : "/mer"} />

        <Section label="Visning">
          <div className="space-y-3">
            <div>
              <p className="mb-2" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)", fontWeight: 600 }}>
                Animasjon og lyd
              </p>
              <Segmented value={fx} onChange={setFxLevel} label="Animasjon og lyd" options={FX_LEVELS.map((l) => ({ value: l, label: FX_LABELS[l] }))} />
              {fx === "simple" && (
                <p className="mt-2" style={{ color: "var(--color-red)", fontSize: "var(--text-micro)" }}>
                  Teller ikke i statistikken
                </p>
              )}
            </div>
            <div>
              <p className="mb-2" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)", fontWeight: 600 }}>
                Tema
              </p>
              <Segmented value={theme} onChange={setTheme} label="Tema" options={[{ value: "dark", label: "Mørk", icon: <MoonIcon className="w-4 h-4" /> }, { value: "light", label: "Dag", icon: <SunIcon className="w-4 h-4" /> }]} />
            </div>
            <SwitchRow label="Odds" checked={showOdds} onChange={setShowOdds} />
            <SwitchRow label="Tekstur" checked={texture} onChange={setTexture} />
            <SwitchRow label="Lyd i knapper" hint="Party og Full party" checked={uiSoundOn} onChange={setUiSound} />
          </div>
        </Section>

        <SpotifyControl />

        {!limited && (
          <Section label="Storskjerm">
            <div className="space-y-2">
              <LinkRow label="Kamp" icon={<TvIcon className="w-5 h-5" />} onClick={() => setQr("live")} />
              <LinkRow label="Turnering" icon={<TvIcon className="w-5 h-5" />} onClick={() => setQr("turnering")} />
            </div>
          </Section>
        )}

        {qr && (
          <Sheet title={qr === "live" ? "Storskjerm: kamp" : "Storskjerm: turnering"} onClose={() => setQr(null)}>
            <div className="flex justify-center pb-2">
              <QrCode text={`${origin}${qr === "live" ? "/storskjerm" : "/storskjerm/turnering"}`} label={qr === "live" ? "QR-kode til storskjermen" : "QR-kode til turneringsbraketten på storskjermen"} />
            </div>
          </Sheet>
        )}
      </div>
    </div>
  );
}
