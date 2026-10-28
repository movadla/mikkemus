import type { TierId } from "@/lib/career";
import { HOME, STAGE } from "@/lib/scenePalette";
import { PubScene } from "./PubScene";

const R = STAGE.region;
const N = STAGE.nm;
const G = STAGE.gs;
const W = STAGE.vm;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** A dartboard, small, for the middle of a stage. */
function Board({ x, y, r = 22 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r + 5} fill={HOME.boardDark} />
      <circle r={r} fill={HOME.boardCream} />
      <circle r={r} fill="none" stroke={HOME.boardRed} strokeWidth={r / 5} strokeDasharray={`${r / 2.7} ${r / 2.7}`} />
      <circle r={r * 0.4} fill={HOME.boardGreen} />
      <circle r={r * 0.18} fill={HOME.boardRed} />
    </g>
  );
}

/** Rows of spectators: round heads on shoulders, small. */
function Crowd({ y, fill, rows = 2, step = 16, seed = 0 }: { y: number; fill: string; rows?: number; step?: number; seed?: number }) {
  return (
    <g fill={fill}>
      {range(rows).map((r) =>
        range(Math.ceil(480 / step) + 1).map((i) => {
          const wobble = Math.sin(i * 12.9 + r * 4.1 + seed) * 3;
          const x = i * step + (r % 2) * (step / 2);
          return (
            <g key={`${r}-${i}`} transform={`translate(${x} ${y + r * 13 + wobble})`}>
              <circle cx="0" cy="-6" r="4.6" />
              <path d="M-7 10C-7 0 -4 -2 0 -2C4 -2 7 0 7 10Z" />
            </g>
          );
        }),
      )}
    </g>
  );
}

function Svg({ id, label, children, top, bottom }: { id: string; label: string; children: React.ReactNode; top: string; bottom: string }) {
  return (
    <svg viewBox="0 0 480 300" role="img" aria-label={label} className="w-full block" style={{ borderRadius: "var(--radius-l)", background: top }}>
      <defs>
        <linearGradient id={`sc-bg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="480" height="300" fill={`url(#sc-bg-${id})`} />
      {children}
    </svg>
  );
}

/** A cone of light from the ceiling. `delay` makes the cones breathe out of step. */
function Cone({ x, w = 70, color, delay = 0, opacity = 0.28 }: { x: number; w?: number; color: string; delay?: number; opacity?: number }) {
  return <path d={`M${x - 6} 0H${x + 6}L${x + w} 250H${x - w}Z`} fill={color} opacity={opacity} className="sc-pulse" style={{ animationDelay: `${delay}s` }} />;
}

/** The regional hall: a sports hall with bleachers, pennants swaying from the roof, and the board lit at the centre of the court. */
function RegionHall() {
  return (
    <Svg id="region" label="Regionhallen" top={R.top} bottom={R.bottom}>
      <rect x="0" y="86" width="480" height="96" fill={R.wall} />
      <Crowd y={110} fill={R.crowd} rows={4} step={15} seed={1} />
      {range(7).map((i) => (
        <g key={i} className="sc-sway" style={{ animationDelay: `${i * 0.35}s` }}>
          <path d={`M${40 + i * 66} 0V26`} stroke={R.pennantAlt} strokeWidth="1.5" />
          <path d={`M${40 + i * 66 - 13} 26H${40 + i * 66 + 13}L${40 + i * 66} 62Z`} fill={i % 2 ? R.pennantAlt : R.pennant} />
        </g>
      ))}
      <Cone x={150} color={R.beam} delay={0} />
      <Cone x={330} color={R.beam} delay={1.1} />
      <path d="M0 182H480V300H0Z" fill={R.floor} />
      {range(8).map((i) => (
        <path key={i} d={`M${i * 70 - 40} 300L${240 + (i - 3.5) * 14} 182`} stroke={R.floorLine} strokeWidth="2" opacity=".8" />
      ))}
      <rect x="0" y="182" width="480" height="3" fill={R.floorLine} />
      <ellipse cx="240" cy="236" rx="130" ry="26" fill={R.beam} opacity=".14" />
      <rect x="236" y="168" width="8" height="64" fill={R.stand} />
      <Board x={240} y={156} r={26} />
    </Svg>
  );
}

/** The national arena: a red carpet to a lit stage, banners of the nation, a crowd waving flags, and spotlights sweeping over it all. */
function NationalArena() {
  return (
    <Svg id="nm" label="Nasjonalarenaen" top={N.top} bottom={N.bottom}>
      <rect x="0" y="70" width="480" height="112" fill={N.wall} />
      <Crowd y={100} fill={N.crowd} rows={5} step={14} seed={2} />
      {range(9).map((i) => (
        <g key={i} className="sc-wave" style={{ animationDelay: `${(i % 4) * 0.25}s` }} transform={`translate(${24 + i * 54} ${96 + (i % 3) * 12})`}>
          <path d="M0 0V-24" stroke={N.flag} strokeWidth="1.6" />
          <path d="M0 -24H16V-14H0Z" fill={i % 2 ? N.flagRed : N.flag} />
          <path d="M5 -24V-14M0 -19H16" stroke={N.flagBlue} strokeWidth="2.4" />
        </g>
      ))}
      <g className="sc-sweep-a">
        <path d="M120 0L60 260H180Z" fill={N.beam} opacity=".22" />
      </g>
      <g className="sc-sweep-b">
        <path d="M360 0L300 260H420Z" fill={N.beam} opacity=".22" />
      </g>
      <path d="M240 64L222 74V92C222 100 232 104 240 108C248 104 258 100 258 92V74Z" fill={N.flagRed} stroke={N.gold} strokeWidth="2" />
      <path d="M0 182H480V300H0Z" fill={N.wall} />
      <path d="M205 182H275L380 300H100Z" fill={N.carpet} />
      <path d="M205 182L100 300M275 182L380 300" stroke={N.carpetEdge} strokeWidth="3" />
      <rect x="196" y="160" width="88" height="24" rx="3" fill={N.podium} stroke={N.gold} strokeWidth="2" />
      <Board x={240} y={132} r={24} />
    </Svg>
  );
}

/** Grand Slam: a stage under a truss of lights, a screen behind, lasers fanning out and smoke on the floor. */
function SlamStage() {
  return (
    <Svg id="gs" label="Slam-arenaen" top={G.top} bottom={G.bottom}>
      <rect x="0" y="0" width="480" height="30" fill={G.truss} />
      {range(12).map((i) => (
        <circle key={i} cx={20 + i * 40} cy="16" r="4.5" fill={i % 2 ? G.laser : G.beam} className="sc-twinkle" style={{ animationDelay: `${(i % 5) * 0.3}s` }} />
      ))}
      <rect x="110" y="48" width="260" height="120" rx="6" fill={G.screen} stroke={G.accent} strokeWidth="3" />
      <text x="240" y="100" textAnchor="middle" className="font-display" fontSize="34" fill={G.screenText} letterSpacing="3">
        GRAND
      </text>
      <text x="240" y="140" textAnchor="middle" className="font-display" fontSize="34" fill={G.laser} letterSpacing="3">
        SLAM
      </text>
      {[-1, 1].map((side) => (
        <g key={side} transform={`translate(${side < 0 ? 40 : 440} 30)`}>
          {range(5).map((i) => (
            <g key={i} className={side < 0 ? "sc-laser-l" : "sc-laser-r"} style={{ animationDelay: `${i * 0.18}s` }}>
              <path d={`M0 0L${side * 300} ${60 + i * 46}`} stroke={i % 2 ? G.laser : G.beam} strokeWidth="2.2" opacity=".8" />
            </g>
          ))}
        </g>
      ))}
      <rect x="0" y="206" width="480" height="94" fill={G.stage} />
      <rect x="0" y="206" width="480" height="3" fill={G.accent} />
      <Board x={240} y={188} r={20} />
      {range(4).map((i) => (
        <ellipse key={i} cx={60 + i * 120} cy="270" rx="110" ry="16" fill={G.smoke} opacity=".22" className="sc-drift" style={{ animationDelay: `${i * 0.8}s` }} />
      ))}
      <Crowd y={286} fill={G.pit} rows={1} step={13} seed={3} />
    </Svg>
  );
}

const BURSTS: [number, number, string, number][] = [[90, 70, W.spark, 0], [390, 60, W.spark2, 0.7], [240, 40, W.spark3, 1.4], [150, 120, W.spark2, 2.1], [340, 118, W.spark, 2.8]];

/** The world championship: a globe turning over the stage, golden rays, fireworks bursting, and a crowd with its phones lit. */
function WorldStage() {
  return (
    <Svg id="vm" label="Verdensarenaen" top={W.top} bottom={W.bottom}>
      <g className="sc-rays" style={{ transformOrigin: "240px 130px" }}>
        {range(14).map((i) => (
          <path key={i} d={`M240 130L${240 + Math.cos((i / 14) * Math.PI * 2) * 360} ${130 + Math.sin((i / 14) * Math.PI * 2) * 360}L${240 + Math.cos(((i + 0.45) / 14) * Math.PI * 2) * 360} ${130 + Math.sin(((i + 0.45) / 14) * Math.PI * 2) * 360}Z`} fill={W.beam} opacity=".13" />
        ))}
      </g>
      {BURSTS.map(([x, y, color, d]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <g className="sc-burst" style={{ animationDelay: `${d}s` }}>
            {range(12).map((i) => (
              <path key={i} d={`M0 0L${Math.cos((i / 12) * Math.PI * 2) * 30} ${Math.sin((i / 12) * Math.PI * 2) * 30}`} stroke={color} strokeWidth="2" strokeLinecap="round" />
            ))}
          </g>
        </g>
      ))}
      <g transform="translate(240 120)">
        <circle r="58" fill={W.globe} />
        <path d="M-58 0H58M-50 -28H50M-50 28H50" stroke={W.globeLine} strokeWidth="1.5" opacity=".8" />
        {[0, 1, 2].map((i) => (
          <ellipse key={i} rx="58" ry="58" fill="none" stroke={W.globeLine} strokeWidth="1.5" opacity=".8" className="sc-meridian" style={{ animationDelay: `${-i * 1.2}s` }} />
        ))}
        <circle r="58" fill="none" stroke={W.gold} strokeWidth="3" />
      </g>
      <rect x="150" y="190" width="180" height="14" rx="3" fill={W.plinth} stroke={W.gold} strokeWidth="2" />
      <Board x={240} y={176} r={16} />
      <rect x="0" y="236" width="480" height="64" fill={W.deep} />
      <Crowd y={252} fill={W.crowd} rows={3} step={12} seed={4} />
      {range(16).map((i) => (
        <circle key={i} cx={14 + i * 30} cy={244 + (i % 3) * 12} r="1.8" fill={W.spark} className="sc-twinkle" style={{ animationDelay: `${(i % 6) * 0.25}s` }} />
      ))}
    </Svg>
  );
}

/** The picture for the opening of an event: each step of the ladder has its own place, its own light and its own movement. */
export function EventScene({ tier }: { tier: TierId }) {
  if (tier === "lu") return <PubScene />;
  if (tier === "region") return <RegionHall />;
  if (tier === "nm") return <NationalArena />;
  if (tier === "gs") return <SlamStage />;
  return <WorldStage />;
}
