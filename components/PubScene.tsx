import { PUB as C } from "@/lib/scenePalette";

const BRICKS = Array.from({ length: 9 }, (_, i) => i);
const STARS: [number, number, number][] = [[40, 24, 1.2], [96, 52, 1], [170, 18, 1.4], [250, 40, 1], [330, 16, 1.2], [420, 44, 1.4], [455, 22, 1]];
const BULBS = Array.from({ length: 13 }, (_, i) => i);

/** One person at a window: head and shoulders, small. */
function Patron({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={C.person}>
      <circle cx="0" cy="-12" r="6.5" />
      <path d="M-13 14C-13 -2 -8 -6 0 -6C8 -6 13 -2 13 14Z" />
    </g>
  );
}

/**
 * The pub the career begins in: a corner pub on a dark street, windows lit, a sign over the door and a dartboard on the wall inside. Drawn
 * with shapes only, so it has no copyright or logos to worry about, and it follows no theme (it is night in both).
 */
export function PubScene() {
  return (
    <svg viewBox="0 0 480 300" role="img" aria-label="Puben Lü en kveld" className="w-full block" style={{ borderRadius: "var(--radius-l)", background: C.skyTop }}>
      <defs>
        <linearGradient id="pub-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.skyTop} />
          <stop offset="1" stopColor={C.skyBottom} />
        </linearGradient>
        <linearGradient id="pub-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.glass} />
          <stop offset="1" stopColor={C.glassDeep} />
        </linearGradient>
        <radialGradient id="pub-lamp">
          <stop offset="0" stopColor={C.lampGlow} stopOpacity=".8" />
          <stop offset="1" stopColor={C.lampGlow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pub-wet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.wet} stopOpacity=".35" />
          <stop offset="1" stopColor={C.wet} stopOpacity="0" />
        </linearGradient>
        <pattern id="pub-brick" width="32" height="16" patternUnits="userSpaceOnUse">
          <rect width="32" height="16" fill={C.brick} />
          <path d="M0 .5H32M0 8.5H32M.5 0V8M16.5 8V16" stroke={C.brickLine} strokeWidth="1.3" fill="none" />
        </pattern>
      </defs>
      <rect width="480" height="300" fill="url(#pub-sky)" />
      {STARS.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={C.star} opacity=".7" />
      ))}
      <circle cx="430" cy="38" r="12" fill={C.moon} opacity=".9" />
      {/* The buildings behind */}
      <rect x="0" y="110" width="70" height="150" fill={C.farBuilding} />
      <rect x="410" y="96" width="70" height="164" fill={C.farBuilding} />
      {[[14, 130], [38, 130], [14, 162], [428, 116], [452, 116], [452, 150]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="12" height="16" fill={C.farWindow} opacity=".7" />
      ))}
      {/* The pub */}
      <rect x="70" y="84" width="340" height="170" fill="url(#pub-brick)" />
      <rect x="62" y="72" width="356" height="16" fill={C.cornice} />
      <rect x="70" y="244" width="340" height="12" fill={C.cornice} />
      {BRICKS.map((i) => (
        <rect key={i} x={70 + i * 38} y="88" width="2" height="4" fill={C.cornice} opacity=".5" />
      ))}
      {/* The windows: left a table and two people, right the dartboard on the wall */}
      <rect x="92" y="126" width="96" height="78" rx="3" fill={C.frame} />
      <rect x="98" y="132" width="84" height="66" fill="url(#pub-glass)" />
      <Patron x={122} y={178} s={1.1} />
      <Patron x={156} y={182} s={1} />
      <rect x="98" y="190" width="84" height="8" fill={C.person} opacity=".55" />
      <path d="M140 132V198" stroke={C.frame} strokeWidth="3" />
      <rect x="292" y="126" width="96" height="78" rx="3" fill={C.frame} />
      <rect x="298" y="132" width="84" height="66" fill="url(#pub-glass)" />
      <circle cx="354" cy="162" r="23" fill={C.boardDark} />
      <circle cx="354" cy="162" r="16" fill={C.boardCream} />
      <circle cx="354" cy="162" r="16" fill="none" stroke={C.boardRed} strokeWidth="3" strokeDasharray="6 6" />
      <circle cx="354" cy="162" r="7" fill={C.boardGreen} />
      <circle cx="354" cy="162" r="3" fill={C.boardRed} />
      <Patron x={318} y={184} s={1} />
      <path d="M340 132V198" stroke={C.frame} strokeWidth="3" opacity="0" />
      {/* The door and the sign over it */}
      <rect x="206" y="142" width="68" height="102" rx="3" fill={C.doorEdge} />
      <rect x="211" y="147" width="58" height="97" fill={C.door} />
      <path d="M211 164A29 17 0 0 1 269 164V147H211Z" fill="url(#pub-glass)" opacity=".9" />
      <rect x="255" y="196" width="4" height="12" rx="2" fill={C.brass} />
      <rect x="190" y="98" width="100" height="32" rx="4" fill={C.signBoard} stroke={C.signRim} strokeWidth="2" />
      <text x="240" y="119" textAnchor="middle" className="font-display" fontSize="20" fill={C.signText} letterSpacing="4">
        LÜ
      </text>
      {/* Three darts on the blade sign */}
      <g stroke={C.arrow} strokeWidth="2" strokeLinecap="round">
        <path d="M392 96V108M400 96V108M408 96V108" />
      </g>
      <rect x="386" y="92" width="28" height="3" fill={C.signRim} />
      {/* A string of bulbs along the cornice */}
      {BULBS.map((i) => (
        <g key={i}>
          <circle cx={80 + i * 27} cy={92 + Math.sin(i * 1.3) * 3 + 6} r="6" fill={C.bulbs} opacity=".25" className="sc-twinkle" style={{ animationDelay: `${(i % 5) * 0.3}s` }} />
          <circle cx={80 + i * 27} cy={92 + Math.sin(i * 1.3) * 3 + 6} r="2.4" fill={C.bulbs} />
        </g>
      ))}
      {/* The street, with the light of the windows in it */}
      <rect x="0" y="256" width="480" height="44" fill={C.street} />
      <rect x="0" y="256" width="480" height="3" fill={C.streetEdge} />
      <path d="M92 258H188L214 300H70Z" fill="url(#pub-wet)" />
      <path d="M292 258H388L410 300H270Z" fill="url(#pub-wet)" />
      <path d="M206 258H274L290 300H190Z" fill="url(#pub-wet)" opacity=".8" />
      {/* The street lamp */}
      <circle cx="36" cy="150" r="70" fill="url(#pub-lamp)" />
      <rect x="34" y="150" width="4" height="110" fill={C.lampPost} />
      <rect x="26" y="144" width="20" height="8" rx="3" fill={C.lampPost} />
      <circle cx="36" cy="154" r="4" fill={C.lampGlow} />
      {/* The board on the pavement */}
      <g transform="translate(300 262)">
        <path d="M0 34L10 0L38 0L48 34Z" fill={C.chalkBoard} stroke={C.signRim} strokeWidth="2" />
        <text x="24" y="14" textAnchor="middle" fontSize="7" fontWeight="700" fill={C.chalkText}>
          LÜ-CUP
        </text>
        <text x="24" y="25" textAnchor="middle" fontSize="6" fill={C.chalkText} opacity=".85">
          i kveld
        </text>
      </g>
    </svg>
  );
}
