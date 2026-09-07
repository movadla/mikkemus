"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BOOM_DEFAULT,
  CROWD_DEFAULT,
  playBoom,
  playCrowd,
  playFanfareVariant,
  playHitStreakSound,
  playPerfectRoundVariant,
  primeAudio,
  type BoomParams,
  type CrowdParams,
} from "@/lib/fanfare";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
      <p className="mb-3" style={{ color: "var(--color-gold)", fontSize: "0.85rem", letterSpacing: "0.1em" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Slider({
  label,
  low,
  high,
  value,
  onChange,
  accent,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span style={{ color: "var(--color-cream)", fontSize: "0.8rem" }}>{label}</span>
        <span className="tabular" style={{ color: accent, fontWeight: 700, fontSize: "1rem" }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${FOCUS_RING}`}
        style={{ accentColor: accent, height: "28px" }}
        aria-label={label}
      />
      <div className="flex justify-between" style={{ color: "var(--color-muted)", fontSize: "0.62rem" }}>
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function PlayButton({ onClick, accent, children }: { onClick: () => void; accent: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tactile w-full py-3.5 rounded-lg font-semibold ${FOCUS_RING}`}
      style={{ background: accent, color: "var(--color-bg)" }}
    >
      {children}
    </button>
  );
}

/** Preset combinations worth hearing before touching the sliders — each one lands somewhere
 *  distinctly different in the space, so they double as a map of what the knobs can do. */
const BOOM_PRESETS: { label: string; params: BoomParams }[] = [
  { label: "Lett dunk", params: { darkness: 1, volume: 2, grit: 1 } },
  { label: "Halvmørk", params: { darkness: 2, volume: 3, grit: 2 } },
  { label: "Mørk", params: { darkness: 3, volume: 4, grit: 2 } },
  { label: "Veldig mørk", params: { darkness: 5, volume: 4, grit: 1 } },
  { label: "Kinodrønn", params: { darkness: 5, volume: 5, grit: 4 } },
  { label: "Rå og grusete", params: { darkness: 4, volume: 5, grit: 5 } },
];

const CROWD_PRESETS: { label: string; params: CrowdParams }[] = [
  { label: "Noen få klapper", params: { darkness: 3, volume: 1, density: 1 } },
  { label: "Halvmørk jubel", params: { darkness: 4, volume: 3, density: 3 } },
  { label: "Full pub", params: { darkness: 3, volume: 4, density: 4 } },
  { label: "Stadion", params: { darkness: 2, volume: 5, density: 5 } },
  { label: "Mørk og dempet", params: { darkness: 5, volume: 3, density: 4 } },
  { label: "Lys og tett", params: { darkness: 1, volume: 4, density: 5 } },
];

export default function LydPage() {
  const [boom, setBoom] = useState<BoomParams>(BOOM_DEFAULT);
  const [crowd, setCrowd] = useState<CrowdParams>(CROWD_DEFAULT);

  const boomAccent = "var(--color-red)";
  const crowdAccent = "var(--color-gold-strong)";

  return (
    <div
      className="animate-screen-enter min-h-screen w-full p-4"
      style={{ background: "var(--color-bg)" }}
      // Any tap here unlocks audio playback for the page — see primeAudio.
      onPointerDownCapture={primeAudio}
    >
      <div className="max-w-md mx-auto pb-10">
        <div className="flex items-center justify-between mb-5 pt-2">
          <Link
            href="/"
            className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
          >
            ← Hjem
          </Link>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.5rem" }}>
            Lyder
          </h1>
          <span className="w-16" aria-hidden />
        </div>

        <p className="mb-5 px-1" style={{ color: "var(--color-muted)", fontSize: "0.8rem", lineHeight: 1.5 }}>
          Skru på knottene til du finner lyden du vil ha, og si fra hvilke tall du landet på — så gjør jeg dem til
          standard i spillet. Tallene vises over hver knott.
        </p>

        <Panel title="BOOM — DYPT ANSLAG VED TREFF">
          <Slider
            label="Mørkhet"
            low="1 · halvmørk, kort"
            high="5 · veldig mørk, lang"
            value={boom.darkness}
            onChange={(v) => setBoom({ ...boom, darkness: v })}
            accent={boomAccent}
          />
          <Slider
            label="Volum"
            low="1 · forsiktig"
            high="5 · kraftig"
            value={boom.volume}
            onChange={(v) => setBoom({ ...boom, volume: v })}
            accent={boomAccent}
          />
          <Slider
            label="Støy / grus"
            low="1 · rein tone"
            high="5 · mye anslag"
            value={boom.grit}
            onChange={(v) => setBoom({ ...boom, grit: v })}
            accent={boomAccent}
          />
          <PlayButton onClick={() => playBoom(boom)} accent={boomAccent}>
            ▶ Spill boom ({boom.darkness}·{boom.volume}·{boom.grit})
          </PlayButton>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {BOOM_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setBoom(p.params);
                  playBoom(p.params);
                }}
                className={`tactile py-2.5 rounded-lg ${FOCUS_RING}`}
                style={{ background: "var(--color-cell)", color: "var(--color-cream)", fontSize: "0.75rem" }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="PUBLIKUMSJUBEL">
          <Slider
            label="Mørkhet"
            low="1 · lys og tynn"
            high="5 · mørk og dempet"
            value={crowd.darkness}
            onChange={(v) => setCrowd({ ...crowd, darkness: v })}
            accent={crowdAccent}
          />
          <Slider
            label="Volum"
            low="1 · spredt"
            high="5 · hele lokalet"
            value={crowd.volume}
            onChange={(v) => setCrowd({ ...crowd, volume: v })}
            accent={crowdAccent}
          />
          <Slider
            label="Tetthet / lengde"
            low="1 · få stemmer"
            high="5 · tett folkemengde"
            value={crowd.density}
            onChange={(v) => setCrowd({ ...crowd, density: v })}
            accent={crowdAccent}
          />
          <PlayButton onClick={() => playCrowd(crowd)} accent={crowdAccent}>
            ▶ Spill jubel ({crowd.darkness}·{crowd.volume}·{crowd.density})
          </PlayButton>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {CROWD_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setCrowd(p.params);
                  playCrowd(p.params);
                }}
                className={`tactile py-2.5 rounded-lg ${FOCUS_RING}`}
                style={{ background: "var(--color-cell)", color: "var(--color-cream)", fontSize: "0.75rem" }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="OPPTRAPPING — SLIK DET VILLE HØRTES UT I SPILLET">
          <p className="mb-3" style={{ color: "var(--color-muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
            Bruker jubel-innstillingene over, med volum og tetthet trappet opp per treff.
          </p>
          <div className="space-y-2">
            {[1, 2, 3].map((step) => (
              <PlayButton
                key={step}
                accent={crowdAccent}
                onClick={() => {
                  const scaled: CrowdParams = {
                    darkness: crowd.darkness,
                    volume: Math.min(5, crowd.volume - 2 + step),
                    density: Math.min(5, crowd.density - 2 + step),
                  };
                  playBoom(boom);
                  playCrowd(scaled);
                }}
              >
                ▶ Treff {step} av 3 {step === 3 ? "— alle tre" : ""}
              </PlayButton>
            ))}
          </div>
        </Panel>

        <p className="mb-4 mt-6 px-1" style={{ color: "var(--color-muted)", fontSize: "0.75rem", lineHeight: 1.5 }}>
          Under ligger de gamle messing-lydene, i tilfelle du vil sammenligne. Ingenting her er koblet inn i spillet
          ennå — alt spilles bare på denne siden til du har bestemt deg.
        </p>

        <Panel title="GAMLE MESSING-LYDER">
          <div className="space-y-2">
            <PlayButton onClick={() => playFanfareVariant(1)} accent="var(--color-gold)">
              ▶ Fanfare 1 — stigende kall
            </PlayButton>
            <PlayButton onClick={() => playFanfareVariant(2)} accent="var(--color-gold)">
              ▶ Fanfare 2 — charge!
            </PlayButton>
            <PlayButton onClick={() => playFanfareVariant(3)} accent="var(--color-gold)">
              ▶ Fanfare 3 — bred og pompøs
            </PlayButton>
            <PlayButton onClick={() => playPerfectRoundVariant(1)} accent="var(--color-teal)">
              ▶ Perfekt runde 1
            </PlayButton>
            <PlayButton onClick={() => playPerfectRoundVariant(2)} accent="var(--color-teal)">
              ▶ Perfekt runde 2
            </PlayButton>
            <PlayButton onClick={() => playHitStreakSound(1)} accent="var(--color-green)">
              ▶ Dagens dunk-pling (pil 1)
            </PlayButton>
            <PlayButton onClick={() => playHitStreakSound(2)} accent="var(--color-green)">
              ▶ Dagens dunk-pling (pil 1+2)
            </PlayButton>
          </div>
        </Panel>

        <p className="mt-6 px-1 text-center" style={{ color: "var(--color-muted)", fontSize: "0.7rem", lineHeight: 1.5 }}>
          Hører du ingenting: sjekk at telefonen ikke står på stille, og trykk én gang til — første trykk låser opp lyd
          i nettleseren. De dypeste boom-ene gjengis dårlig på telefonhøyttaler; hør dem på en ordentlig høyttaler før
          du forkaster dem.
        </p>
      </div>
    </div>
  );
}
