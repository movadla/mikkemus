import { useEffect } from "react";
import { careerSound } from "@/lib/uiSound";
import type { Tier } from "@/lib/career";
import { dollars } from "@/lib/career";
import { cupColor } from "@/lib/botCup";
import { PUB, STAGE } from "@/lib/scenePalette";
import { EventScene } from "./EventScenes";
import { CoinIcon } from "./icons";
import { PlayButton } from "./PlayButton";
import { CountUp } from "./ui/CountUp";
import { CupEmblem } from "./ui/CupEmblem";

/** The ground each event stands on: the top and the bottom of its sky or its roof. */
export const GROUND = {
  lu: [PUB.skyTop, PUB.skyBottom],
  region: [STAGE.region.top, STAGE.region.bottom],
  nm: [STAGE.nm.top, STAGE.nm.bottom],
  gs: [STAGE.gs.top, STAGE.gs.bottom],
  vm: [STAGE.vm.top, STAGE.vm.bottom],
} as const;

/**
 * The scene before the draw, one for each event: the pub on a Friday evening, the regional hall, the national arena, Grand Slam under its lasers
 * and the world championship under fireworks. It grows with the event: the pub is a warm picture and a line, the bigger ones add the title
 * slamming in, the prize counting up and, from Grand Slam, the black bars of a film opening. Nothing here is needed to play: the button is
 * there from the start.
 */
export function EventIntro({ tier, onDone }: { tier: Tier; onDone: () => void }) {
  // The crowd of the place swells as the scene comes up: the murmur of the pub, a hall filling, an arena roaring.
  useEffect(() => {
    careerSound(tier.scale <= 1 ? "crowd-1" : tier.scale <= 3 ? "crowd-2" : "crowd-3");
  }, [tier.scale]);
  const [top, bottom] = GROUND[tier.id];
  const big = tier.scale >= 3;
  return (
    <div
      className="animate-screen-enter screen cup-lamp intro-stage"
      style={{ "--cup": cupColor(tier.kind), "--beam": tier.scale >= 5 ? 0.5 : tier.scale >= 4 ? 0.36 : 0.22, background: `linear-gradient(${top}, ${bottom})` } as React.CSSProperties}
      data-scale={tier.scale}
      data-tier={tier.id}
    >
      {tier.scale >= 4 && (
        <>
          <div className="intro-bar intro-bar-top" aria-hidden />
          <div className="intro-bar intro-bar-bottom" aria-hidden />
        </>
      )}
      {big && <div className="intro-beams" aria-hidden />}
      <div className="screen-inner relative z-10 flex flex-col items-center text-center" style={{ minHeight: "88dvh", justifyContent: "center", gap: "0.9rem" }}>
        <div className="intro-zoom w-full relative">
          <EventScene tier={tier.id} />
          <span className="intro-badge" style={{ color: "var(--cup)" }}>
            <CupEmblem kind={tier.kind} className="w-6 h-6" />
          </span>
        </div>
        <p className="section-label intro-rise" style={{ "--d": "0.5s", color: "var(--cup)" } as React.CSSProperties}>
          {tier.stage.toUpperCase()}
        </p>
        <h1 className={`font-display ${big ? "intro-slam" : "intro-rise"}`} style={{ "--d": "0.7s", color: "var(--color-cream)", fontSize: `clamp(1.7rem, 8.4vw, ${2.2 + tier.scale * 0.3}rem)`, lineHeight: 1.05 } as React.CSSProperties}>
          {tier.name}
        </h1>
        <span className="intro-rise inline-flex items-center gap-2 tabular" style={{ "--d": "1s", padding: "0.35rem 0.9rem", borderRadius: "var(--radius-pill)", background: "var(--gold-soft)", border: "1px solid var(--color-gold)", color: "var(--color-gold-strong)", fontWeight: 800, fontSize: "var(--text-title)" } as React.CSSProperties}>
          <CoinIcon className="w-5 h-5" />
          <CountUp value={tier.prizes.winner ?? 0} format={dollars} />
        </span>
        <div className="w-full intro-rise" style={{ "--d": "1.4s" } as React.CSSProperties}>
          <PlayButton label="TREKK" onClick={onDone} />
        </div>
      </div>
    </div>
  );
}
