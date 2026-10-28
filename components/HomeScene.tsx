import { START_ARENA, type Arena, type HomeId, type SlotId } from "@/lib/career";
import { HOME as C } from "@/lib/scenePalette";

const NAME: Record<HomeId, string> = { garage: "Garasjen", basement: "Kjelleren", loft: "Loftet" };
const DUST: [number, number][] = [[150, 90], [210, 130], [300, 70], [340, 150], [250, 180], [120, 160]];
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** One person in the room: head and shoulders. */
function Figure({ x, y, s = 1, fill = C.figure }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <circle cx="0" cy="-12" r="6.5" />
      <path d="M-13 14C-13 -2 -8 -6 0 -6C8 -6 13 -2 13 14Z" />
    </g>
  );
}

/** The dartboard, in the step it has been bought in: on a plank, in a cabinet, with a black surround, or with a ring of light. */
function Board({ step }: { step: number }) {
  return (
    <g transform="translate(239 134)">
      {step === 0 && <rect x="-34" y="21" width="68" height="10" rx="1" fill={C.wood} />}
      {step === 1 && (
        <>
          <rect x="-40" y="-40" width="80" height="80" rx="4" fill={C.panelLine} />
          <rect x="-46" y="-42" width="8" height="84" fill={C.panel} />
          <rect x="38" y="-42" width="8" height="84" fill={C.panel} />
        </>
      )}
      {step >= 2 && <circle r="40" fill={C.boardDark} />}
      {step >= 3 && <circle r="43" fill="none" stroke={C.led} strokeWidth="3" className="sc-twinkle" />}
      <circle r="30" fill={C.boardDark} />
      <circle r="22" fill={C.boardCream} />
      <circle r="22" fill="none" stroke={C.boardRed} strokeWidth="4" strokeDasharray="8 8" />
      <circle r="9" fill={C.boardGreen} />
      <circle r="4" fill={C.boardRed} />
    </g>
  );
}

/**
 * Where the career is lived: the garage, the basement or the loft the player started in, and what has been bought for it. Each of the six things in
 * the shop (lib/career.ts SLOTS) is drawn in the step it is at, so a purchase shows in the room at once; `pop` is the one just bought, which flashes.
 * The first pictures of the home arena; better ones come later (CAREER_ART_PLAN.md). Shapes only, the same in both themes.
 */
export function HomeScene({ home, arena = START_ARENA, pop = null, compact = false }: { home: HomeId; arena?: Arena; pop?: SlotId | null; compact?: boolean }) {
  const a = { ...START_ARENA, ...arena };
  const flash = (id: SlotId) => (pop === id ? "arena-pop" : undefined);
  return (
    <svg viewBox="0 0 480 300" role="img" aria-label={`${NAME[home]} din`} preserveAspectRatio={compact ? "xMidYMid slice" : undefined} className="w-full block" style={{ borderRadius: "var(--radius-l)", background: C.concreteDark, height: compact ? "8.5rem" : undefined }}>
      <defs>
        <radialGradient id="home-bulb" cx="50%" cy="0%" r="90%">
          <stop offset="0" stopColor={C.bulbGlow} stopOpacity=".55" />
          <stop offset="1" stopColor={C.bulbGlow} stopOpacity="0" />
        </radialGradient>
        <pattern id="home-brick" width="32" height="16" patternUnits="userSpaceOnUse">
          <rect width="32" height="16" fill={C.brickWall} />
          <path d="M0 .5H32M0 8.5H32M.5 0V8M16.5 8V16" stroke={C.brickLine} strokeWidth="1.3" fill="none" />
        </pattern>
      </defs>

      {/* The wall: what the place had, or what it has become */}
      <g className={flash("wall")}>
        {a.wall === 0 && home === "garage" && (
          <>
            <rect width="480" height="300" fill={C.concrete} />
            <rect x="0" y="0" width="150" height="214" fill={C.door} />
            {range(8).map((i) => (
              <rect key={i} x="0" y={14 + i * 26} width="150" height="3" fill={C.doorLine} />
            ))}
          </>
        )}
        {a.wall === 0 && home === "basement" && (
          <>
            <rect width="480" height="300" fill="url(#home-brick)" />
            <rect x="0" y="34" width="480" height="7" fill={C.pipe} />
            <rect x="0" y="41" width="480" height="3" fill={C.pipeDark} />
            <rect x="60" y="34" width="6" height="60" fill={C.pipe} />
            <rect x="360" y="18" width="70" height="24" fill={C.concreteDark} />
            <rect x="366" y="22" width="58" height="16" fill={C.cold} opacity=".8" />
          </>
        )}
        {a.wall === 0 && home === "loft" && (
          <>
            <rect width="480" height="300" fill={C.plank} />
            {range(12).map((i) => (
              <rect key={i} x={i * 40} y="0" width="2" height="230" fill={C.plankLine} />
            ))}
            <path d="M0 0H480V34L0 96Z" fill={C.roof} />
            <path d="M0 96L480 34V42L0 106Z" fill={C.roofBeam} />
            <circle cx="400" cy="120" r="30" fill={C.roofBeam} />
            <circle cx="400" cy="120" r="24" fill={C.moon} opacity=".85" />
            <path d="M400 96V144M376 120H424" stroke={C.roofBeam} strokeWidth="3" />
          </>
        )}
        {a.wall === 1 && <rect width="480" height="300" fill={C.painted} />}
        {a.wall === 2 && (
          <>
            <rect width="480" height="300" fill={C.panel} />
            {range(16).map((i) => (
              <rect key={i} x={i * 30} y="0" width="2.5" height="214" fill={C.panelLine} />
            ))}
            <rect x="0" y="150" width="480" height="4" fill={C.panelLine} />
          </>
        )}
        {a.wall === 3 && (
          <>
            <rect width="480" height="300" fill={C.arenaWall} />
            <rect x="96" y="22" width="288" height="170" rx="5" fill={C.stage} stroke={C.led} strokeWidth="2" className="sc-twinkle" />
            {range(7).map((i) => (
              <rect key={i} x={110 + i * 40} y="196" width="24" height="3" fill={C.led} opacity=".6" />
            ))}
          </>
        )}
      </g>

      {/* The floor, and the line to throw from */}
      <g className={flash("floor")}>
        <rect x="0" y="214" width="480" height="86" fill={a.floor === 0 ? C.floor : a.floor === 1 ? C.laminate : a.floor === 2 ? C.carpet : C.stage} />
        {a.floor === 1 && range(12).map((i) => <rect key={i} x={i * 42} y="214" width="1.5" height="86" fill={C.laminateLine} />)}
        {a.floor === 2 && <rect x="150" y="240" width="180" height="52" rx="3" fill={C.carpetLine} opacity=".7" />}
        {a.floor === 3 && <rect x="0" y="214" width="480" height="4" fill={C.gold} className="sc-twinkle" />}
        <rect x="0" y="214" width="480" height="3" fill={C.floorLine} opacity={a.floor === 3 ? 0 : 1} />
        <rect x="170" y="270" width="140" height="4" rx="2" fill={C.line} opacity=".85" />
      </g>

      {/* The decoration: a box and a bucket, then a chalkboard, a shelf with a neon sign, and a cabinet with banners */}
      <g className={flash("decor")}>
        {a.decor === 0 && (
          <>
            <rect x="48" y="184" width="52" height="30" fill={C.box} />
            <rect x="48" y="184" width="52" height="5" fill={C.boxDark} />
            <path d="M110 214L113 190H131L134 214Z" fill={C.concrete} stroke={C.line} strokeWidth="1" opacity=".9" />
          </>
        )}
        {a.decor === 1 && (
          <>
            <rect x="40" y="100" width="64" height="48" rx="2" fill={C.chalk} stroke={C.wood} strokeWidth="4" />
            <path d="M48 114H92M48 126H80M48 138H70" stroke={C.line} strokeWidth="2" opacity=".8" />
            <rect x="390" y="96" width="34" height="46" fill={C.boardCream} />
            <circle cx="407" cy="114" r="9" fill={C.boardRed} />
          </>
        )}
        {a.decor === 2 && (
          <>
            <rect x="36" y="120" width="84" height="5" fill={C.wood} />
            {[52, 76, 100].map((x) => (
              <path key={x} d={`M${x - 6} 120L${x - 4} 102H${x + 4}L${x + 6} 120Z`} fill={C.gold} />
            ))}
            <text x="396" y="120" textAnchor="middle" className="font-display sc-twinkle" fontSize="20" fill={C.neon} letterSpacing="2">
              DARTS
            </text>
          </>
        )}
        {a.decor === 3 && (
          <>
            <rect x="30" y="86" width="82" height="108" rx="3" fill={C.panelLine} stroke={C.gold} strokeWidth="2" />
            <rect x="36" y="92" width="70" height="96" fill={C.glass} opacity=".25" />
            {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={44 + c * 22} y={100 + r * 30} width="10" height="18" rx="2" fill={C.gold} />))}
            {[380, 420].map((x) => (
              <path key={x} d={`M${x} 40V120L${x + 14} 106L${x + 28} 120V40Z`} fill={C.banner} stroke={C.gold} strokeWidth="2" />
            ))}
          </>
        )}
      </g>

      {/* The light: one bulb, a spotlight, a ring and two spots, or a rig */}
      <g className={flash("light")}>
        {a.light === 0 && (
          <>
            <rect x="238" y="0" width="2" height="38" fill={C.wire} />
            <circle cx="239" cy="44" r="12" fill="url(#home-bulb)" />
            <ellipse cx="239" cy="140" rx="150" ry="150" fill="url(#home-bulb)" />
            <circle cx="239" cy="44" r="5" fill={C.bulb} />
          </>
        )}
        {a.light === 1 && (
          <>
            <rect x="226" y="0" width="26" height="14" rx="3" fill={C.wire} />
            <path d="M232 14H246L296 214H182Z" fill={C.bulbGlow} opacity=".28" className="sc-pulse" />
          </>
        )}
        {a.light === 2 && (
          <>
            <circle cx="239" cy="134" r="52" fill="none" stroke={C.bulb} strokeWidth="5" opacity=".9" />
            <circle cx="239" cy="134" r="52" fill="none" stroke={C.bulbGlow} strokeWidth="14" opacity=".25" />
            {[110, 368].map((x) => (
              <path key={x} d={`M${x} 0L${x + (x < 239 ? 40 : -40)} 214H${x + (x < 239 ? 120 : -120)}Z`} fill={C.bulbGlow} opacity=".16" className="sc-pulse" />
            ))}
          </>
        )}
        {a.light === 3 && (
          <>
            <rect x="60" y="0" width="360" height="10" fill={C.wire} />
            {range(6).map((i) => (
              <g key={i}>
                <circle cx={90 + i * 60} cy="14" r="6" fill={i % 2 ? C.led : C.bulb} className="sc-twinkle" style={{ animationDelay: `${i * 0.2}s` }} />
                <path d={`M${90 + i * 60} 14L${239 + (i - 2.5) * 36} 214H${239 + (i - 2.5) * 36 + 30}Z`} fill={i % 2 ? C.led : C.bulbGlow} opacity=".14" className="sc-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
              </g>
            ))}
          </>
        )}
      </g>

      <g className={flash("board")}>
        <Board step={a.board} />
      </g>

      {/* The people: nobody, one friend, five at the bar, a full house */}
      <g className={flash("crowd")}>
        {a.crowd === 1 && <Figure x={400} y={252} s={1.3} />}
        {a.crowd === 2 && [60, 100, 380, 420, 450].map((x, i) => <Figure key={x} x={x} y={258 + (i % 2) * 6} s={1.25} />)}
        {a.crowd === 3 &&
          range(2).map((r) => range(14).map((i) => <Figure key={`${r}-${i}`} x={i * 36 + (r % 2) * 18 + 10} y={246 + r * 18} s={1.3 + r * 0.2} fill={C.crowdDark} />))}
      </g>

      {DUST.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill={C.dust} opacity=".5" />
      ))}
    </svg>
  );
}
