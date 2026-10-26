/** The symbol of the app: a ring and a dart that has landed at its centre. One colour, so it sits on any ground. */
export function BrandSymbol({ size = 28, color = "var(--color-teal)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="16" cy="16" r="12" />
      <circle cx="16" cy="16" r="6.5" opacity="0.55" />
      <circle cx="16" cy="16" r="1.6" fill={color} stroke="none" />
      {/* The dart: a shaft from the upper right into the centre, and its flight. */}
      <path d="M16 16 28.5 3.5" />
      <path d="M24.5 3.5h4v4" />
      <path d="M21 7.5l3.5-.5.5 3.5" opacity="0.8" />
    </svg>
  );
}

/** The word mark: "Mikke Mus" in the display face, with the symbol in front when `symbol` is set. */
export function Wordmark({ size = "title", symbol = true, align = "left" }: { size?: "title" | "num"; symbol?: boolean; align?: "left" | "center" }) {
  const px = size === "num" ? 30 : 22;
  return (
    <span className={`inline-flex items-center gap-2 ${align === "center" ? "justify-center" : ""}`}>
      {symbol && <BrandSymbol size={px + 4} />}
      <span className="font-display" style={{ fontSize: size === "num" ? "var(--text-num)" : "var(--text-title)", letterSpacing: "0.01em", color: "var(--color-cream)", lineHeight: 1 }}>
        Mikke Mus
      </span>
    </span>
  );
}
