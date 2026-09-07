"use client";

import { useEffect, useMemo, useState } from "react";
import { generateConfettiRain } from "@/lib/confetti";

const AUTO_DISMISS_MS = 7000;
const RAIN_COUNT = 70;

/**
 * The rarest turn in the game: three darts, three triples, every one of them on the number
 * that was active when it was thrown. Rare enough to deserve interrupting the screen for —
 * and since Scolia sends photos of the board itself (verified against a real payload: three
 * base64 JPEGs per takeout), the celebration can show the actual darts sitting in the board
 * rather than just saying it happened.
 *
 * The photo arrives a beat later than the third dart does (Scolia sends it around takeout),
 * so this opens immediately on the achievement and slots the image in when it lands. It
 * always auto-dismisses — a celebration that has to be cleared by hand becomes an
 * obstruction the third time it fires.
 */
export function TripleCelebration({ images, onDismiss }: { images: string[]; onDismiss: () => void }) {
  const [visible, setVisible] = useState(true);
  const rain = useMemo(() => generateConfettiRain(RAIN_COUNT), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  const photo = images[0];

  return (
    <div
      role="dialog"
      aria-label="Tre trippel"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-hidden"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={() => {
        setVisible(false);
        onDismiss();
      }}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {rain.map((c, i) => (
          <span
            key={i}
            className="confetti-rain"
            style={
              {
                left: c.left,
                width: c.width,
                height: c.height,
                background: c.color,
                animationDelay: c.delay,
                animationDuration: c.duration,
                "--r": c.rotate,
                "--fall": c.fall,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="animate-winner-pop relative z-10 w-full max-w-sm text-center">
        <p
          className="font-display"
          style={{ color: "var(--color-gold)", fontSize: "2.6rem", lineHeight: 1.05, letterSpacing: "0.02em" }}
        >
          TRE TRIPLER
        </p>
        <p className="mb-4" style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>
          Tre piler, tre trippel, alle på tallet du jaktet på.
        </p>

        {photo ? (
          <div
            className="animate-winner-photo-pulse rounded-xl overflow-hidden mx-auto"
            style={{ border: "3px solid var(--color-gold)", boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI straight from the board, nothing next/image can optimize */}
            <img src={photo} alt="Blinken etter runden" className="w-full h-auto block" />
          </div>
        ) : (
          <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>Venter på bilde fra brettet …</p>
        )}

        <p className="mt-4" style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
          Trykk for å lukke
        </p>
      </div>
    </div>
  );
}
