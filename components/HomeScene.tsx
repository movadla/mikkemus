import type { HomeId } from "@/lib/career";
import { HOME as C } from "@/lib/scenePalette";

const NAME: Record<HomeId, string> = { garage: "Garasjen", basement: "Kjelleren", loft: "Loftet" };
const DUST: [number, number][] = [[150, 90], [210, 130], [300, 70], [340, 150], [250, 180], [120, 160]];

/** The dartboard on its plank, the one thing the three places have in common. */
function Board({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-34" y="-5" width="68" height="10" rx="1" fill={C.wood} transform="translate(0 26)" />
      <circle r="30" fill={C.boardDark} />
      <circle r="22" fill={C.boardCream} />
      <circle r="22" fill="none" stroke={C.boardRed} strokeWidth="4" strokeDasharray="8 8" />
      <circle r="9" fill={C.boardGreen} />
      <circle r="4" fill={C.boardRed} />
    </g>
  );
}

/**
 * Where the career is lived: the garage, the basement or the loft the player started in, drawn dim, with a dartboard on a plank and a bare bulb.
 * The first step of the home arena; later steps are better pictures of the same place (CAREER_ART_PLAN.md). Shapes only, the same in both themes.
 */
export function HomeScene({ home, compact = false }: { home: HomeId; compact?: boolean }) {
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
      {home === "garage" && (
        <>
          <rect width="480" height="300" fill={C.concrete} />
          <rect x="0" y="0" width="150" height="214" fill={C.door} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x="0" y={14 + i * 26} width="150" height="3" fill={C.doorLine} />
          ))}
          <rect x="330" y="120" width="120" height="6" fill={C.wood} />
          <rect x="344" y="96" width="34" height="24" fill={C.box} />
          <rect x="344" y="96" width="34" height="5" fill={C.boxDark} />
          <rect x="392" y="104" width="22" height="16" fill={C.boxDark} />
        </>
      )}
      {home === "basement" && (
        <>
          <rect width="480" height="300" fill="url(#home-brick)" />
          <rect x="0" y="34" width="480" height="7" fill={C.pipe} />
          <rect x="0" y="41" width="480" height="3" fill={C.pipeDark} />
          <rect x="60" y="34" width="6" height="60" fill={C.pipe} />
          <rect x="360" y="18" width="70" height="24" fill={C.concreteDark} />
          <rect x="366" y="22" width="58" height="16" fill={C.cold} opacity=".8" />
          <rect x="380" y="140" width="52" height="46" fill={C.box} />
          <rect x="380" y="140" width="52" height="6" fill={C.boxDark} />
        </>
      )}
      {home === "loft" && (
        <>
          <rect width="480" height="300" fill={C.plank} />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <rect key={i} x={i * 40} y="0" width="2" height="230" fill={C.plankLine} />
          ))}
          <path d="M0 0H480V34L0 96Z" fill={C.roof} />
          <path d="M0 96L480 34V42L0 106Z" fill={C.roofBeam} />
          <circle cx="400" cy="120" r="30" fill={C.roofBeam} />
          <circle cx="400" cy="120" r="24" fill={C.moon} opacity=".85" />
          <path d="M400 96V144M376 120H424" stroke={C.roofBeam} strokeWidth="3" />
          <path d="M376 150L330 230H430Z" fill={C.moon} opacity=".12" />
        </>
      )}
      {/* The floor, and the line to throw from */}
      <rect x="0" y="214" width="480" height="86" fill={C.floor} />
      <rect x="0" y="214" width="480" height="3" fill={C.floorLine} />
      <rect x="170" y="270" width="140" height="4" rx="2" fill={C.line} opacity=".8" />
      {/* The one bulb, and what it lights */}
      <rect x="238" y="0" width="2" height="38" fill={C.wire} />
      <circle cx="239" cy="44" r="12" fill="url(#home-bulb)" />
      <ellipse cx="239" cy="140" rx="150" ry="150" fill="url(#home-bulb)" />
      <circle cx="239" cy="44" r="5" fill={C.bulb} />
      <Board x={239} y={134} />
      {DUST.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill={C.dust} opacity=".5" />
      ))}
    </svg>
  );
}
