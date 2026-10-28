import { useEffect, useState } from "react";
import { careerSound } from "@/lib/uiSound";
import type { Tier } from "@/lib/career";
import { dollars } from "@/lib/career";
import { PUB, STAGE, TROPHY } from "@/lib/scenePalette";
import { TIER_LOOK, foilVars } from "@/lib/materials";
import { TrophyArt } from "./CareerTrophy";
import { EVENT_PICTURES } from "./eventPictures";
import { EventScene } from "./EventScenes";
import { PlayButton } from "./PlayButton";

/** The ground each event stands on: the top and the bottom of its sky or its roof. */
export const GROUND = {
  lu: [PUB.skyTop, PUB.skyBottom],
  region: [STAGE.region.top, STAGE.region.bottom],
  nm: [STAGE.nm.top, STAGE.nm.bottom],
  gs: [STAGE.gs.top, STAGE.gs.bottom],
  vm: [STAGE.vm.top, STAGE.vm.bottom],
} as const;

/** The colour of the light of each event. */
const BEAM = { lu: PUB.glow, region: STAGE.region.beam, nm: STAGE.nm.beam, gs: STAGE.gs.beam, vm: STAGE.vm.beam } as const;

/** How hard the name hits, by the size of the event: how far it falls from, the shake of the screen and the size of the type. */
const SLAM = [
  { sc: 1, sh: 0, size: 2.0 },
  { sc: 1.25, sh: 0, size: 2.1 },
  { sc: 1.9, sh: 3, size: 2.25 },
  { sc: 2.3, sh: 5, size: 2.45 },
  { sc: 2.7, sh: 7, size: 2.7 },
  { sc: 3.2, sh: 9, size: 2.9 },
] as const;

const CONFETTI = ["var(--color-cream)", "var(--color-gold-strong)", "var(--color-teal)"];

/**
 * The opening of an event, and it grows with the event. The colour of the event comes up from the button, lights sweep, the stage is written
 * out, the cup falls, the name hits with a blow to the screen, and three plates slide in with the players, the stake and the first prize.
 * The pub is warm and quiet; the regional hall adds beams and a small blow; from the national championship there are black bars and confetti,
 * Grand Slam adds lasers and the world championship fireworks and the hardest blow. A tap anywhere takes it to the end at once, and the
 * button is there from the first second, so nothing here is needed to play.
 */
export function EventIntro({ tier, player, onDone }: { tier: Tier; player: string; onDone: () => void }) {
  // The crowd of the place swells as the scene comes up: the murmur of the pub, a hall filling, an arena roaring.
  useEffect(() => {
    careerSound(tier.scale <= 1 ? "crowd-1" : tier.scale <= 3 ? "crowd-2" : "crowd-3");
  }, [tier.scale]);
  const [skip, setSkip] = useState(false);
  const pictures = EVENT_PICTURES[tier.id];
  const [top, bottom] = GROUND[tier.id];
  const s = tier.scale;
  const slam = SLAM[s];
  const beams = [
    ["18%", 14, 0.5],
    ["50%", 10, 0.4],
    ["82%", 14, 0.5],
    ["34%", 20, 0.3],
    ["66%", 20, 0.3],
  ].slice(0, s <= 1 ? 2 : s === 2 ? 3 : 5) as [string, number, number][];
  const colours = [TROPHY[tier.id], ...CONFETTI];
  const confetti = s >= 3 ? Array.from({ length: s === 3 ? 18 : 30 }, (_, i) => ({ x: (i * 37) % 100, c: colours[i % 4], d: 1.9 + ((i * 13) % 14) / 10, r: ((i * 83) % 700) - 350 })) : [];
  return (
    <div
      className={`ev ${skip ? "ev-skip" : ""}`}
      style={{ "--c": TROPHY[tier.id], "--top": top, "--bot": bottom, "--beam": BEAM[tier.id], "--laser": STAGE.gs.laser, "--sh": `${slam.sh}px`, "--sc": slam.sc } as React.CSSProperties}
      data-scale={s}
      data-tier={tier.id}
      onClick={() => setSkip(true)}
    >
      <div className="ev-from" aria-hidden />
      {pictures ? (
        // The place the event is played in, from outside: the picture of the event.
        <div className="ev-photo" role="img" aria-label={pictures.alt}>
          {/* eslint-disable-next-line @next/next/no-img-element -- one fixed picture from public/career */}
          <img src={pictures.outside} alt="" style={{ objectPosition: pictures.outsideFocus }} />
        </div>
      ) : (
        <div className="ev-scene" aria-hidden>
          <EventScene tier={tier.id} />
        </div>
      )}
      {s >= 3 && (
        <>
          <div className="ev-bar ev-bar-t" aria-hidden />
          <div className="ev-bar ev-bar-b" aria-hidden />
        </>
      )}
      {beams.map(([x, a, o], i) => (
        <div key={i} className="ev-beam" aria-hidden style={{ "--x": x, "--a": `${a}deg`, "--bo": o * (s >= 4 ? 1.3 : 0.9) } as React.CSSProperties} />
      ))}
      {s >= 4 && [0, 1, 2].map((i) => <span key={i} className="ev-laser" aria-hidden style={{ top: `${20 + i * 8}%`, "--la": `${12 + i * 14}deg`, "--ld": `${(1.9 + i * 0.25).toFixed(2)}s` } as React.CSSProperties} />)}
      {confetti.map((p, i) => (
        <span key={i} className="ev-conf" aria-hidden style={{ left: `${p.x}%`, background: p.c, "--cd": `${p.d.toFixed(1)}s`, "--r": `${p.r}deg` } as React.CSSProperties} />
      ))}
      {s >= 5 && [[18, 22, 2.1], [78, 30, 2.5], [48, 16, 2.9], [30, 52, 3.2]].map(([x, y, d], i) => <span key={i} className="ev-fw" aria-hidden style={{ left: `${x}%`, top: `${y}%`, "--wd": `${d}s` } as React.CSSProperties} />)}
      <div className="ev-inner">
        <p className="ev-kick">{tier.stage}</p>
        <div className="ev-cup">
          <TrophyArt kind={tier.id} bare />
        </div>
        <h1 className="ev-title" style={{ fontSize: `clamp(1.7rem, 8.4vw, ${slam.size}rem)` }}>
          {s >= 4 ? (
            <span className="neon" style={{ "--c": TIER_LOOK[tier.id].tint } as React.CSSProperties}>
              {tier.name}
            </span>
          ) : (
            <span className="foil" data-t={tier.name} style={foilVars(tier.id) as React.CSSProperties}>
              {tier.name}
            </span>
          )}
          <span className="ev-ring" aria-hidden />
        </h1>
        <ul className="ev-plates" aria-label="Om turneringen">
          <li className="ev-plate" style={{ "--i": "0s", "--fx": "-60px" } as React.CSSProperties}>
            <small>Spillere</small>
            <b>{tier.size}</b>
          </li>
          <li className="ev-plate" style={{ "--i": "0.12s", "--fx": "60px" } as React.CSSProperties}>
            <small>Innskudd</small>
            <b>{tier.fee === 0 ? "Gratis" : dollars(tier.fee)}</b>
          </li>
          <li className="ev-plate ev-plate-prize" style={{ "--i": "0.24s", "--fx": "-60px" } as React.CSSProperties}>
            <small>Til vinneren</small>
            <b>{dollars(tier.prizes.winner ?? 0)}</b>
          </li>
        </ul>
        <p className="ev-you">
          <b>{player}</b> er med. Trekningen starter nå.
        </p>
        <div className="ev-go" onClick={(e) => e.stopPropagation()}>
          <PlayButton label="TREKK" onClick={onDone} />
        </div>
      </div>
    </div>
  );
}
