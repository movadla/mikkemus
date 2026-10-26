"use client";

import { spotifyConfigured, useSpotify } from "@/lib/spotify";
import { SpeakerIcon } from "./icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * Spotify's volume from the app, and the login that allows it. Renders nothing until a Spotify client id is configured
 * (see lib/spotify.ts), so the rest of the app looks the same without it.
 *
 * Spotify itself decides which devices may be steered from outside: most phones report that they cannot, and for those the
 * slider is replaced by a note instead of a control that does nothing.
 */
export function SpotifyControl({ compact = false }: { compact?: boolean }) {
  const { state, volume, setVolume, refused, connect, disconnect } = useSpotify(true);
  if (!spotifyConfigured) return null;

  return (
    <div className={compact ? "mt-4" : "mb-6"}>
      <p className="section-label mb-2">SPOTIFY</p>
      {state.kind === "off" && (
        <button
          type="button"
          onClick={() => void connect()}
          className={`tactile w-full rounded-lg font-medium ${FOCUS_RING}`}
          style={{ minHeight: "var(--control)", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "var(--text-body)" }}
        >
          Koble til Spotify
        </button>
      )}
      {state.kind === "nothing" && (
        <p className="text-center" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
          Ingenting spilles på Spotify akkurat nå. Start en sang, så dukker volumet opp her.
        </p>
      )}
      {state.kind === "device" && (
        <div>
          <p className="text-center mb-2 truncate" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
            {state.device.name}
          </p>
          {state.device.supportsVolume ? (
            <label className="flex items-center gap-3">
              <SpeakerIcon className="w-5 h-5" />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={volume ?? state.device.volume ?? 50}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Spotify-volum"
                className="flex-1"
                style={{ accentColor: "var(--color-teal)" }}
              />
              <span className="tabular" style={{ color: "var(--color-cream)", fontSize: "var(--text-small)", minWidth: "2.5rem", textAlign: "right" }}>
                {volume ?? state.device.volume ?? 50} %
              </span>
            </label>
          ) : (
            <p className="text-center" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
              Spotify lar ikke denne enheten styres utenfra. Bruk volumknappene på selve enheten.
            </p>
          )}
          {refused && (
            <p role="alert" className="text-center mt-2" style={{ color: "var(--color-red)", fontSize: "var(--text-micro)" }}>
              Spotify avviste endringen. Det krever Premium og en enhet som kan styres.
            </p>
          )}
        </div>
      )}
      {state.kind !== "off" && (
        <button type="button" onClick={disconnect} className={`mt-2 w-full text-center ${FOCUS_RING}`} style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>
          Koble fra Spotify
        </button>
      )}
    </div>
  );
}
