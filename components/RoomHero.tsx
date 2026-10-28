"use client";
/* eslint-disable @next/next/no-img-element -- the room pictures are fixed files from public/career */
import { useState } from "react";
import { STAGES, roomPicture } from "@/lib/career";

export type BuyMode = "wipe" | "lights";

/** The steps that are about light get the lights going on; every other one is uncovered by a sweep of light. */
export const buyMode = (stage: number): BuyMode => (stage === 4 || stage === 9 ? "lights" : "wipe");

/** When the new room is in place, in seconds from the press: what comes after (the title, the band, the new things) follows it. */
export const revealAt = (mode: BuyMode) => (mode === "lights" ? 1.2 : 1.3);

const DUST = Array.from({ length: 14 }, (_, i) => ({ x: 8 + ((i * 53) % 84), y: 56 + ((i * 37) % 26), d: 0.5 + (i % 5) * 0.06, ux: ((i * 29) % 60) - 30, uy: -30 - ((i * 11) % 50) }));

/**
 * The room as it is in the room screen: the picture of the step, large, from the top of the screen and fading into the dark under it. When a
 * step has just been bought (`playing`) the old room is on top and the new one comes up under it: a sweep of light that uncovers it, or the
 * lights going out and on again. After that (`compare`) the player can drag between the room as it was and as it is.
 */
export function RoomHero({ stage, before, playing, compare, mode }: { stage: number; before: number | null; playing: boolean; compare: boolean; mode: BuyMode }) {
  const [x, setX] = useState(50);
  const changed = before !== null && before !== stage;
  const label = `Rommet ditt, trinn ${stage + 1}: ${STAGES[stage].name}`;
  return (
    <>
      <div className="room-hero-ground" aria-hidden />
      <div className="room-hero" data-compare={compare && changed ? "" : undefined}>
        <img key={stage} src={roomPicture(stage)} alt={label} className="room-hero-img room-hero-new" />
        {changed && (playing || compare) && <img src={roomPicture(before)} alt="" aria-hidden className="room-hero-img room-hero-old" style={compare && !playing ? { clipPath: `inset(0 0 0 ${x}%)` } : undefined} />}
        {playing && changed && (
          <>
            <span className="room-hero-edge" />
            <span className="room-hero-flash" />
            {mode === "lights" && DUST.map((d, i) => <span key={i} className="room-hero-dust" style={{ left: `${d.x}%`, top: `${d.y}%`, "--dd": `${d.d}s`, "--ux": `${d.ux}px`, "--uy": `${d.uy}px` } as React.CSSProperties} />)}
            <span className="room-hero-stamp">NYTT I ROMMET</span>
          </>
        )}
        {compare && changed && !playing && (
          <>
            <span className="room-hero-edge room-hero-edge-on" style={{ left: `${x}%` }} />
            <span className="room-hero-tag room-hero-tag-l">ETTER</span>
            <span className="room-hero-tag room-hero-tag-r">FØR</span>
          </>
        )}
        <span className="room-hero-top" />
      </div>
      {compare && changed && !playing && <input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} aria-label="Dra for å sammenligne rommet før og etter" className="room-hero-slider" />}
    </>
  );
}

/** Seven coins that fly from the button that was pressed to the balance. Fixed to the screen, so it does not matter where they start. */
export type CoinFlightPath = { x0: number; y0: number; x1: number; y1: number };
export function CoinFlight({ path }: { path: CoinFlightPath }) {
  return (
    <span aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className="coin-fly" style={{ left: path.x0, top: path.y0, "--dx": `${path.x1 - path.x0 + ((i % 3) - 1) * 8}px`, "--dy": `${path.y1 - path.y0}px`, "--cd": `${(0.05 + i * 0.07).toFixed(2)}s` } as React.CSSProperties} />
      ))}
    </span>
  );
}
