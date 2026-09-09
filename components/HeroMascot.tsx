"use client";

/**
 * The mascot, cut out and faded at the feet into the ground (see .hero-mascot in globals.css),
 * over a breathing gold bloom. The home screen's headpiece, and — smaller — the same face on
 * every setup screen, so leaving home for a mode does not feel like leaving the app.
 */
export function HeroMascot({ small = false }: { small?: boolean }) {
  return (
    <div className={`relative mx-auto flex items-center justify-center ${small ? "mb-1" : "mb-3"}`} aria-hidden>
      <span className={`hero-glow animate-idle-glow absolute ${small ? "hero-glow--sm" : ""}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mikke.webp" alt="" className={`hero-mascot relative ${small ? "hero-mascot--sm" : ""}`} width={420} height={747} />
    </div>
  );
}
