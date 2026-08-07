const CREAM = "#f4f0e8";
const GOLD = "#c9a24b";
const GREEN = "#11160f";

function ring(pct: number, background: string, children?: React.ReactNode) {
  return (
    <div
      style={{
        width: `${pct}%`,
        height: `${pct}%`,
        borderRadius: "50%",
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

/** A minimal concentric-ring bullseye — the app's icon, favicon, and PWA glyph. */
export function dartIcon() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: GREEN,
      }}
    >
      {ring(86, CREAM, ring(64, GREEN, ring(44, GOLD, ring(24, GREEN, ring(11, CREAM)))))}
    </div>
  );
}
